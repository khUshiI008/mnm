import client from './client';
import { EmployeeBrandOption } from './employeeLiveStockApi';

// Backed by the shared dbo.ArticlePictures table — the SAME one the .NET web
// portal's Article Picture page writes to, so web and app uploads are one pool.
// imagePath is "/Content/Uploads/..." (web upload) or "/uploads/..." (app upload);
// resolveFileUrl() routes each to the right host.
export type ArticlePictureDto = {
  articleNo: string;
  color: string;
  brandId: number | null;
  brandName: string | null;
  imagePath: string;
  uploadedByName: string | null;
  uploadedDate: string | null;
};

export type ArticleMatch = { articleNo: string; qtySold: number; lastSold: string | null; picture: ArticlePictureDto | null };

export type ArticlePictureRequest = { articleNo: string; brandId: number; brandName: string; color: string; requestedDate: string | null };

export const getArticlePictureBrands = () => client.get<{ success: boolean; brands: EmployeeBrandOption[] }>('/article-pictures/brands');

/** `q` = the last few digits of the Article No (matches Article Nos ending with it; falls back to "contains"). */
export const searchArticles = (brandId: number, q: string) =>
  client.get<{ success: boolean; articles: ArticleMatch[] }>('/article-pictures/articles', { params: { brandId, q } });

export const getArticlePictures = (brandId: number) =>
  client.get<{ success: boolean; pictures: ArticlePictureDto[] }>('/article-pictures', { params: { brandId } });

export const getArticlePictureRequests = () => client.get<{ success: boolean; requests: ArticlePictureRequest[] }>('/article-pictures/requests');

/** `image` is a data-URI (data:image/jpeg;base64,...). Re-uploading the same Article replaces its picture. */
export const uploadArticlePicture = (body: { brandId: number; articleNo: string; color?: string; image: string }) =>
  client.post<{ success: boolean; picture: ArticlePictureDto }>('/article-pictures', body, { timeout: 60000 });
