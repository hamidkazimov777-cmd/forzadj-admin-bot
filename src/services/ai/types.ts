export interface AIInput {
  artist?: string;
  title?: string;
  album?: string;
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
