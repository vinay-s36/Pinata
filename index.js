import express from 'express';
import multer from 'multer';
import { PinataSDK } from 'pinata';
import fs from 'fs';
import { Blob } from 'buffer';
import fetch from 'node-fetch';
import 'dotenv/config';
import cors from 'cors';

const app = express();
app.use(cors());
const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.GATEWAY_URL
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload-file', upload.array('files', 10), async (req, res) => {
    try {
        const filePath = req.files[0].path;
        const fileName = req.files[0].originalname;
        const blob = new Blob([fs.readFileSync(filePath)]);
        const file = new File([blob], fileName, { type: req.files[0].mimetype });
        const upload = await pinata.upload.file(file);
        const cid = upload.cid;

        const longUrl = await pinata.gateways.createSignedURL({
            cid: cid,
            expires: 1800,
        });

        const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BITLY_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "long_url": longUrl,
                "domain": "bit.ly"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error shortening URL');
        }

        const shortUrl = data.link;

        fs.unlinkSync(filePath);
        res.json({ shortUrl });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
