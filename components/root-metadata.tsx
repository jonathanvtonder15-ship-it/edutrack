import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
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
