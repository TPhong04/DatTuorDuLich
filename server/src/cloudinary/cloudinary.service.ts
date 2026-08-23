import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

@Injectable()
export class CloudinaryService {
  uploadBuffer(buffer: Buffer, folder: string): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (err, result) => {
          if (err || !result) {
            return reject(new InternalServerErrorException('Upload ảnh lên Cloudinary thất bại'))
          }
          resolve({ url: result.secure_url })
        },
      )
      stream.end(buffer)
    })
  }
}