import { prisma } from '@propgroup/db';

export async function getContentBySection(section: string) {
  return prisma.siteContent.findMany({
    where: { section, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getContentByKey(key: string) {
  return prisma.siteContent.findUnique({ where: { key } });
}

export async function getAllContent() {
  return prisma.siteContent.findMany({
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function upsertContent(
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { section?: string; title?: string; content?: string; metadata?: any; sortOrder?: number; isActive?: boolean },
  updatedBy?: string,
) {
  return prisma.siteContent.upsert({
    where: { key },
    update: { ...data, updatedBy },
    create: {
      key,
      section: data.section || 'general',
      title: data.title,
      content: data.content,
      metadata: data.metadata as undefined,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      updatedBy,
    },
  });
}

export async function deleteContent(key: string) {
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  if (!existing) return null;
  await prisma.siteContent.delete({ where: { key } });
  return existing;
}

// Media

export async function getMediaBySection(section: string) {
  return prisma.siteMedia.findMany({
    where: { section, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getMediaByKey(key: string) {
  return prisma.siteMedia.findUnique({ where: { key } });
}

export async function getAllMedia() {
  return prisma.siteMedia.findMany({
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function upsertMedia(
  key: string,
  data: { section?: string; url: string; alt?: string; caption?: string; width?: number; height?: number; fileSize?: number; mimeType?: string; sortOrder?: number; isActive?: boolean },
  updatedBy?: string,
) {
  return prisma.siteMedia.upsert({
    where: { key },
    update: { ...data, updatedBy },
    create: {
      key,
      section: data.section || 'general',
      url: data.url,
      alt: data.alt,
      caption: data.caption,
      width: data.width,
      height: data.height,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      updatedBy,
    },
  });
}

export async function deleteMedia(key: string) {
  const existing = await prisma.siteMedia.findUnique({ where: { key } });
  if (!existing) return null;
  await prisma.siteMedia.delete({ where: { key } });
  return existing;
}
