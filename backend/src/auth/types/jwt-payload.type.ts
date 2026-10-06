export type JwtPayload = {
  sub: string;
  email: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
};
