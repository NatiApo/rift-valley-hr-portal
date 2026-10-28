export type Job = {
  id: string; title: string; title_am: string | null; department: string | null;
  location: string; employment_type: string; description: string; description_am: string | null;
  requirements: string | null; requirements_am: string | null; deadline: string | null;
  status: "draft" | "published" | "closed"; created_at: string;
};
export type Role = "admin" | "recruiter" | "reviewer";
export type ApplicationStatus = "new" | "under_review" | "shortlisted" | "interview" | "offered" | "hired" | "rejected";
export const statusLabels: Record<ApplicationStatus, string> = {
  new: "New", under_review: "Under review", shortlisted: "Shortlisted",
  interview: "Interview", offered: "Offer made", hired: "Hired", rejected: "Rejected"
};
