/**
 * Validate nghiêm ngặt tiêu chí tìm kiếm đầu vào từ client:
 * 
 * */ 

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsDateString, 
  IsEnum, 
  IsInt, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  Length, 
  Max, 
  Min 
} from 'class-validator';

export enum CabinClassEnum {
  ECONOMY = 'ECONOMY',
  PREMIUM_ECONOMY = 'PREMIUM_ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export class SearchFlightQueryDto {
  @ApiProperty({ description: 'Mã IATA sân bay đi (3 ký tự)', example: 'SGN' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  origin: string;

  @ApiProperty({ description: 'Mã IATA sân bay đến (3 ký tự)', example: 'HAN' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  destination: string;

  @ApiProperty({ description: 'Ngày khởi hành (YYYY-MM-DD)', example: '2026-11-20' })
  @IsDateString()
  @IsNotEmpty()
  departureDate: string;

  @ApiPropertyOptional({ description: 'Ngày về nếu là khứ hồi (YYYY-MM-DD)', example: '2026-11-25' })
  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @ApiProperty({ description: 'Số lượng người lớn (>= 12 tuổi)', default: 1, minimum: 1, maximum: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  adults: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng trẻ em (2 - 11 tuổi)', default: 0, minimum: 0, maximum: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  @IsOptional()
  children?: number = 0;

  @ApiPropertyOptional({ description: 'Số lượng em bé (< 2 tuổi)', default: 0, minimum: 0, maximum: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  @IsOptional()
  infants?: number = 0;

  @ApiPropertyOptional({ enum: CabinClassEnum, default: CabinClassEnum.ECONOMY })
  @IsEnum(CabinClassEnum)
  @IsOptional()
  cabinClass: CabinClassEnum = CabinClassEnum.ECONOMY;
}