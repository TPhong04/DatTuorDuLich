import { Module } from '@nestjs/common'
import { BookingsModule } from '../bookings/bookings.module'
import { TransactionsModule } from '../transactions/transactions.module'
import { PublicPaymentsWebhookController } from './public-payments-webhook.controller'
import { PaymentsService } from './payments.service'
import { MongooseModule } from '@nestjs/mongoose'
import { Transaction, TransactionSchema } from '../transactions/transaction.schema'

@Module({
  imports: [
    BookingsModule,
    TransactionsModule,
    MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }]),
  ],
  controllers: [PublicPaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
