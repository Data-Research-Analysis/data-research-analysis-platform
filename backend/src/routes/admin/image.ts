import express, { Request, Response } from 'express';
import { validateJWT } from '../../middleware/authenticate';
import multer from 'multer';
import path from 'path';
import { UtilityService } from '../../services/UtilityService';
import { IMulterRequest } from '../../types/IMulterRequest';
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

router.post('/upload', async (req: IMulterRequest, res: Response, next: any) => {
    next();
}, validateJWT, upload.single('image'), async (req: IMulterRequest, res: Response) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    const publicUrl = UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL');
    const fileUrl = `${publicUrl}/uploads/${req.file.filename}`;
    res.status(200).json({ url: fileUrl });
});

export default router;