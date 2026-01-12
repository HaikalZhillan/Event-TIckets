import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import {
  PaymentProvider,
  PaymentType,
  PaymentChannel,
  PaymentChannelCode,
  PaymentStatus,
} from '../common/enums/payment.enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    enumName: 'payments_provider_enum',
    default: PaymentProvider.XENDIT,
  })
  provider: PaymentProvider;

  @Column({
    type: 'enum',
    enum: PaymentType,
    enumName: 'payments_type_enum',
    default: PaymentType.INVOICE,
  })
  type: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentChannel,
    enumName: 'payments_channel_enum',
    nullable: true,
  })
  channel?: PaymentChannel;

  @Column({
    type: 'enum',
    enum: PaymentChannelCode,
    enumName: 'payments_channelcode_enum',
    nullable: true,
  })
  channelCode?: PaymentChannelCode;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod?: string;

  @Column({ name: 'reference_id', unique: true })
  referenceId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payments_status_enum',
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ name: 'payment_url', nullable: true })
  paymentUrl: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  // ADD THIS: Make expiresAt a proper column
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // REMOVED: expiresAt: any; <-- This was wrong!
}