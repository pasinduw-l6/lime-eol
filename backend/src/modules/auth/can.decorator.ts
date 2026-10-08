import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const CAN = 'can';

export const Can = (...permissions: Permission[]) => SetMetadata(CAN, permissions);
