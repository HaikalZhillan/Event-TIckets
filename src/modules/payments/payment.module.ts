import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { XenditService } from './xendit.service';
import { OrdersModule } from '../order/orders.module';
import { XenditController } from './xendit.controller';

@Module({
    imports: [ConfigModule, forwardRef(() => OrdersModule)],
    providers: [XenditService],
    controllers: [XenditController],
    exports: [XenditService],
})
export class XenditModule {}