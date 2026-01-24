
import { Speaker, GalleryItem } from './types';

export const EVENT_DETAILS = {
  name: "LTC 3.0",
  fullTheme: "T.I.M.E: The Incredible Me Emerging",
  scripture: "Romans 12:2",
  shortName: "T.I.M.E '26",
  date: "Coming Soon",
  venue: "To Be Announced",
  address: "Lagos, Nigeria",
  lat: 6.6083,
  lng: 3.3339
};

export const LINKS = [
  { label: "Register", url: "https://bit.ly/LTC3Register" },
  { label: "Volunteer", url: "https://bit.ly/LTC3Volunteer" }
];

export const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/lagosteensconference?igsh=MWtoYzBoanY0bTFzdw==", icon: "Instagram" },
  { label: "Twitter", url: "https://x.com/LTC_RCCG?s=20", icon: "Twitter" },
  { label: "Facebook", url: "https://www.facebook.com/share/p/1DXoop4kXD/", icon: "Facebook" },
  { label: "Tiktok", url: "https://www.tiktok.com/@lagosteensconference?is_from_webapp=1&sender_device=pc", icon: "Tiktok" } // Using Music as placeholder for Tiktok if icon unavailable
];

export const SPEAKERS: Speaker[] = [
  // Details to be announced
];

// Using local images
// Using local images
export const GALLERY_RECAP: GalleryItem[] = [
  { id: '1', url: '/images/ltc2/LTC%202.0-100.jpg', caption: 'Praise Session' },
  { id: '2', url: '/images/ltc2/LTC%202.0-106.jpg', caption: 'Worship Wave' },
  { id: '3', url: '/images/ltc2/LTC%202.0-111.jpg', caption: 'Interactive Moments' },
  { id: '4', url: '/images/ltc2/LTC%202.0-14.jpg', caption: 'Prayer Focus' },
  { id: '5', url: '/images/ltc2/LTC%202.0-15.jpg', caption: 'Song Ministration' },
  { id: '6', url: '/images/ltc2/LTC%202.0-18.jpg', caption: 'Leadership' }
];

export const INTERESTS = [
  "Technology", "Music", "Leadership", "Business", "Arts", "Ministry"
];

export const VOLUNTEER_DEPARTMENTS = [
  "Medical", "Counselling", "Protocol/Ushering", "Prayer", "Sanitation", "Registration"
];

export const REGIONS_AND_PROVINCES: Record<string, string[]> = {
  "Region 1": [
    "Region 1 Headquarters", "Lagos Province 1", "Lagos Province 11", "Lagos Province 43",
    "Lagos Province 70", "Lagos Province 73", "Lagos Province 79", "Lagos Province 93",
    "Lagos Province 103", "Lagos Province 110", "Lagos Province 124"
  ],
  "Region 2": [
    "Region 2 Headquarters", "Lagos Province 8", "Lagos Province 13", "Lagos Province 50",
    "Lagos Province 56", "Lagos Province 87", "Lagos Province 95", "Lagos Province 111",
    "Lagos Province 112", "Lagos Province 125"
  ],
  "Region 11": [
    "Region 11 Headquarters", "Lagos Province 6", "Lagos Province 16", "Lagos Province 20",
    "Lagos Province 53", "Lagos Province 65", "Lagos Province 88", "Lagos Province 114"
  ],
  "Region 19": [
    "Region 19 Headquarters", "Lagos Province 2", "Lagos Province 23", "Lagos Province 27",
    "Lagos Province 40", "Lagos Province 60", "Lagos Province 77", "Lagos Province 89",
    "Lagos Province 92", "Lagos Province 115", "Lagos Province 116", "Lagos Province 126",
    "Lagos Province 127"
  ],
  "Region 20": [
    "Region 20 Headquarters", "Lagos Province 4", "Lagos Province 15", "Lagos Province 24",
    "Lagos Province 34", "Lagos Province 35", "Lagos Province 39", "Lagos Province 47",
    "Lagos Province 119", "Lagos Province 131"
  ],
  "Region 26": [
    "Region 26 Headquarters", "Lagos Province 22", "Lagos Province 41", "Lagos Province 58",
    "Lagos Province 63", "Lagos Province 75", "Lagos Province 97"
  ],
  "Region 31": [
    "Region 31 Headquarters", "Lagos Province 7", "Lagos Province 25", "Lagos Province 29",
    "Lagos Province 78", "Lagos Province 101", "Lagos Province 108", "Lagos Province 120",
    "Lagos Province 128"
  ],
  "Region 36": [
    "Region 36 Headquarters", "Lagos Province 12", "Lagos Province 18", "Lagos Province 30",
    "Lagos Province 38", "Lagos Province 72", "Lagos Province 90", "Lagos Province 91",
    "Lagos Province 94", "Lagos Province 121", "Lagos Province 122"
  ],
  "Region 37": [
    "Region 37 Headquarters", "Lagos Province 10", "Lagos Province 17", "Lagos Province 42",
    "Lagos Province 49", "Lagos Province 57", "Lagos Province 83", "Lagos Province 96",
    "Lagos Province 123", "Lagos Province 129"
  ],
  "Region 51": [
    "Region 51 Headquarters", "Lagos Province 5", "Lagos Province 46", "Lagos Province 48",
    "Lagos Province 66", "Lagos Province 67", "Lagos Province 132"
  ],
  "Region 52": [
    "Region 52 Headquarters", "Lagos Province 26", "Lagos Province 31", "Lagos Province 45",
    "Lagos Province 71", "Lagos Province 74", "Lagos Province 82", "Lagos Province 109"
  ],
  "Region 53": [
    "Region 53 Headquarters", "Lagos Province 14", "Lagos Province 51", "Lagos Province 85",
    "Lagos Province 105", "Lagos Province 106"
  ],
  "Region 54": [
    "Region 54 Headquarters", "Lagos Province 3", "Lagos Province 32", "Lagos Province 44",
    "Lagos Province 61", "Lagos Province 81", "Lagos Province 117", "Lagos Province 118",
    "Lagos Province 130"
  ],
  "Region 59": [
    "Region 59 Headquarters", "Lagos Province 19", "Lagos Province 21", "Lagos Province 36",
    "Lagos Province 54", "Lagos Province 64", "Lagos Province 76", "Lagos Province 100",
    "Lagos Province 113"
  ],
  "Region 61": [
    "Region 61 Headquarters", "Lagos Province 37", "Lagos Province 52", "Lagos Province 59",
    "Lagos Province 68", "Lagos Province 80", "Lagos Province 102"
  ],
  "Region 63": [
    "Region 63 Headquarters", "Lagos Province 9", "Lagos Province 28", "Lagos Province 69",
    "Lagos Province 84", "Lagos Province 86", "Lagos Province 104"
  ],
  "Region 64": [
    "Region 64 Headquarters", "Lagos Province 33", "Lagos Province 55", "Lagos Province 62",
    "Lagos Province 98", "Lagos Province 99", "Lagos Province 107"
  ],
  "Continental 3 Headquarters": ["Continental 3 Headquarters"],
  "National Headquarters": ["National Headquarters"]
};
export const TEEN_ROLES = ["Teens Executive", "Worker", "Member"];
export const EXEC_LEVELS = ["Parish", "Zone", "Area", "Province", "Region"];
