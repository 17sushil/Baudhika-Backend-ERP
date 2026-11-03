import { ApiProperty } from '@nestjs/swagger';

/** Access JWT + single-use refresh token, used by both platform and school auth. */
export class TokenPairDto {
  /** JWT for the Authorization: Bearer header. */
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' }) accessToken: string;
  /** Opaque "<uuid>.<secret>". Single use: every refresh returns a new one. */
  @ApiProperty({ example: '1b2c3d4e-…-e9.Qm9vdGNhbXA…' }) refreshToken: string;
  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' }) tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  @ApiProperty({ example: 900 }) expiresIn: number;
}
