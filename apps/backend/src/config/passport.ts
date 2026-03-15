import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { prisma } from '@propgroup/db';

// Configure Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.isActive || user.bannedAt) {
          return done(null, false, { message: 'Account is inactive or banned' });
        }

        if (!user.password) {
          return done(null, false, { message: 'Please sign in with Google' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Configure Google Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          `${process.env.BACKEND_URL}/api/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email provided by Google'));
          }
          const googleId = profile.id;

          // Try to find user by Google ID
          let user = await prisma.user.findUnique({
            where: { googleId },
          });

          // If not found by Google ID, try by email
          if (!user) {
            user = await prisma.user.findUnique({
              where: { email },
            });

            // If user exists with email but no Google ID, link accounts
            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId,
                  provider: 'google',
                  avatar: profile.photos?.[0]?.value,
                  emailVerifiedAt: user.emailVerifiedAt || new Date(),
                  lastLoginAt: new Date(),
                },
              });
            }
          }

          // If still not found, create new user
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                googleId,
                provider: 'google',
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                avatar: profile.photos?.[0]?.value,
                emailVerifiedAt: new Date(),
                isActive: true,
                lastLoginAt: new Date(),
              },
            });
          }

          if (!user.isActive || user.bannedAt) {
            return done(null, false);
          }

          // Update last login
          if (!user.lastLoginAt || Date.now() - new Date(user.lastLoginAt).getTime() > 60000) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
} else {
  console.log('Google OAuth not configured - skipping Google Strategy');
}

export default passport;
