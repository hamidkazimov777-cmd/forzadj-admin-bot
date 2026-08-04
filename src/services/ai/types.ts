export interface AIInput {
  artist?: string;
  title?: string;
  album?: string;
  year?: number;
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  format?: string;
  embeddedGenre?: string;
}

export interface AIOutput {
  genre: string;
  mood: string;
  version: string;
  rating: number;
}
