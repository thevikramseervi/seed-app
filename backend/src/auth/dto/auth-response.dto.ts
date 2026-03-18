import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  user: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    role: string;
    designation: string;
    twoFactorEnabled?: boolean;
  };
}
