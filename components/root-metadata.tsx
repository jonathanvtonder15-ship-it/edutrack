import { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL
if (process.env.NODE_ENV === 'production' && !appUrl) {
  throw new Error('NEXT_PUBLIC_APP_URL is required in production')
}

export const metadata: Metadata = {
  metadataBase: new URL(appUrl || "http://localhost:3000"),
  title: "EduTrack v2",
  description: "School Attendance & Management System",
  icons: {
    icon: "/edutrack.svg",
  },
  openGraph: {
    title: "EduTrack v2",
    description: "School Attendance & Management System",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EduTrack v2",
    description: "School Attendance & Management System",
  },
};
