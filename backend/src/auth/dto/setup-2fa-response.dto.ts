import { ApiProperty } from '@nestjs/swagger';

export class Setup2faResponseDto {
  @ApiProperty({ description: 'otpauth:// URI for QR code (e.g. for Google Authenticator)' })
  otpauthUrl: string;

  @ApiProperty({ description: 'Base32 secret for manual entry if QR cannot be used' })
  secret: string;
}
