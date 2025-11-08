"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Chrome, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define schemas locally to avoid import issues
const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = authSchema
  .extend({
    confirmPassword: z
      .string()
      .min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type AuthData = z.infer<typeof authSchema>;
type SignupData = z.infer<typeof signupSchema>;

type AuthModalProps = {
  children: React.ReactNode;
};

export function AuthModal({ children }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset errors and success messages when switching between login/signup or opening modal
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, isLogin]);

  const loginForm = useForm<AuthData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (data: AuthData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await signIn(data.email, data.password);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Login successful!");
        setTimeout(() => {
          setIsOpen(false);
          loginForm.reset();
          // AuthContext already updated, just close the modal
        }, 300);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await signUp(data.email, data.password);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Account created successfully!");
        setTimeout(() => {
          setIsOpen(false);
          signupForm.reset();
          // AuthContext already updated, just close the modal
        }, 300);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      // Get the API base URL - normalize it
      const { normalizeApiUrl } = await import('@/lib/utils/api-url');
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");

      // Store that we're in a modal flow
      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth_modal", "true");
        sessionStorage.setItem("auth_redirect", window.location.pathname);
      }

      // Redirect to Google OAuth - endpoint is /api/auth/google
      window.location.href = `${apiUrl}/api/auth/google`;
    } catch (err) {
      console.error("Google auth error:", err);
      setError("Failed to initiate Google authentication");
      setIsGoogleLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isLogin ? "Sign In" : "Create Account"}</DialogTitle>
          <DialogDescription>
            {isLogin
              ? "Enter your email and password to sign in to your account."
              : "Enter your details to create a new account."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {isLogin ? (
          <form
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                {...loginForm.register("email")}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
              />
              {loginForm.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                {...loginForm.register("password")}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
              />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading || isLoading}
              className="w-full"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-4 w-4 text-blue-600" />
                  Continue with Google
                </>
              )}
            </Button>

            <div className="flex flex-col space-y-2 pt-2">
              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLogin(false)}
                className="w-full"
                disabled={isLoading || isGoogleLoading}
              >
                Don't have an account? Sign Up
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={signupForm.handleSubmit(handleSignup)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                {...signupForm.register("email")}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
              />
              {signupForm.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {signupForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                {...signupForm.register("password")}
                placeholder="Enter your password (min 6 characters)"
                autoComplete="new-password"
                disabled={isLoading}
              />
              {signupForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {signupForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password">Confirm Password</Label>
              <Input
                id="signup-confirm-password"
                type="password"
                {...signupForm.register("confirmPassword")}
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={isLoading}
              />
              {signupForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">
                  {signupForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading || isLoading}
              className="w-full"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-4 w-4 text-blue-600" />
                  Sign up with Google
                </>
              )}
            </Button>

            <div className="flex flex-col space-y-2 pt-2">
              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLogin(true)}
                className="w-full"
                disabled={isLoading || isGoogleLoading}
              >
                Already have an account? Sign In
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
