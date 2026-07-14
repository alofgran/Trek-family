import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesDownloadController } from './files-download.controller';
import { FilesService } from './files.service';
import { BookingImportModule } from '../booking-import/booking-import.module';

@Module({
  imports: [BookingImportModule],
  controllers: [FilesController, FilesDownloadController],
  providers: [FilesService],
})
export class FilesModule {}
