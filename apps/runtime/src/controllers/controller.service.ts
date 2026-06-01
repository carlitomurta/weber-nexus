// import { ConflictException, Injectable } from '@nestjs/common';
// import type { ControllerRepository } from './controller.repository';

// @Injectable()
// export class ControllerService {
//   constructor(private readonly repository: ControllerRepository) {}

//   async create(dto: CreateControllerDto) {
//     const existing = await this.repository.findByIpAndUnitId(
//       dto.ipAddress,
//       dto.unitId,
//     );

//     if (existing) {
//       throw new ConflictException('Controller already exists');
//     }

//     return this.repository.create(dto);
//   }
// }
