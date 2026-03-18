/**
 * Shape of the user object attached to the request by the JWT strategy.
 * Used with @CurrentUser() in controllers.
 */
export interface JwtUser {
  id: string;
  employeeId: string;
  employeeNumber: number | null;
  name: string;
  email: string;
  role: string;
  designation: string | null;
  status: string;
}
