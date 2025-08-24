import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate.js';
import multer from 'multer';
import { UtilityService } from '../../services/UtilityService.js';
import { IMulterRequest } from '../../types/IMulterRequest.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set the destination directory for uploaded files
    // Ensure this directory exists in your backend project
    cb(null, path.join(__dirname, '../../../public/uploads'));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent overwrites
    // e.g., image-16789012345.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post('/upload', async (req: Request, res: Response, next: any) => {
    next();
}, validateJWT, upload.array('image'), async (req: IMulterRequest, res: Response) => {
    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded.' });
    }
    const publicUrl = UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL');
    const fileUrls = files//?.map(file => `${publicUrl}/uploads/${file.filename}`);
    res.status(200).json({ urls: fileUrls });

});

export default router;