export interface Topic {
  id: string;
  title: string;
  description: string;
}

export interface Module {
  id: string;
  title: string;
  objective: string;
  durationHours: number;
  topics: Topic[];
}

export interface Curriculum {
  id: string;
  subject: string;
  level: string;
  goals: string;
  durationWeeks: number;
  modules: Module[];
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumBrief {
  subject: string;
  level: string;
  goals: string;
  durationWeeks: number;
}
