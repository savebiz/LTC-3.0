export interface DelegateRegistration {
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  region: string;
  province: string;
  role: "Member" | "Worker" | "Teens Executive";
  execLevel?: "Parish" | "Zone" | "Area" | "Province" | "Region";
  execPosition?: string;
}

export interface VolunteerRegistration {
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  region: string;
  province: string;
  role: "Teenager" | "Teacher";
  department: "Medical" | "Counselling" | "Protocol/Ushering" | "Prayer" | "Sanitation" | "Registration";
  experience?: string;
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  image: string;
  isKeynote?: boolean;
}

export interface GalleryItem {
  id: string;
  url: string;
  caption: string;
}
