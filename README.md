# Vault – Password Manager

เว็บแอพจัดการรหัสผ่านแบบ local-first ทุกอย่างเข้ารหัสในเครื่อง ไม่มี server
ติดตั้งลงหน้าโฮมของ iPhone ได้ (PWA) และใช้งานออฟไลน์ได้

## เริ่มใช้งาน

```bash
npm install
npm run dev       # เปิด http://localhost:5173
npm test          # unit tests (crypto, vault, generator)
npm run build     # build ไปที่ dist/
```

### ติดตั้งบน iPhone
WebCrypto ใช้ได้เฉพาะบน HTTPS จึงต้อง deploy `dist/` ขึ้นเว็บโฮสต์ที่เป็น HTTPS ก่อน
(GitHub Pages, Cloudflare Pages, Netlify ฯลฯ) จากนั้นเปิดใน Safari → ปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม”

> ควรติดตั้งเป็นแอพบนหน้าโฮม เพราะ Safari อาจล้างข้อมูลของเว็บที่ไม่ได้เปิดนาน ๆ
> และควรกด “ส่งออกไฟล์สำรอง” เก็บไว้ใน iCloud Drive เป็นระยะ

## การออกแบบความปลอดภัย

```
master password ──Argon2id (64 MiB, t=3, salt 16 B)──▶ KEK  (ไม่ถูกเก็บ)
KEK ──AES-GCM wrap──▶ vault key (AES-256 สุ่ม, 1 อันต่อ vault)
vault key ──AES-256-GCM──▶ แต่ละรายการ (IV สุ่ม 96-bit, AAD = vaultId + itemId)
vault key ──wrap──▶ ECDH P-256 private key (เตรียมไว้สำหรับการแชร์)
```

- ไม่เก็บ master password หรือ hash ของมัน การตรวจรหัสผิดใช้การ authenticate ของ GCM ตอน unwrap vault key
- เปลี่ยน master password = wrap vault key ใหม่เท่านั้น ไม่ต้องเข้ารหัสทุกรายการใหม่
- ชื่อรายการ / username / URL ก็ถูกเข้ารหัสทั้งหมด ใน IndexedDB มีแต่ ciphertext
- AAD ผูกแต่ละ ciphertext กับ id ของมัน ป้องกันการสลับข้อมูลระหว่างรายการ
- ล็อกอัตโนมัติเมื่อไม่ได้ใช้ 5 นาที หรืออยู่เบื้องหลังเกิน 1 นาที; รีเฟรชหน้า = ล็อก
- คัดลอกรหัสแล้วพยายามล้าง clipboard ใน 30 วินาที (iOS อาจไม่อนุญาต)
- Production build ใส่ CSP เข้มงวด: ห้ามโหลดสคริปต์ภายนอกและห้ามเชื่อมต่อ network อื่น
- ตัวสร้างรหัสผ่านใช้ `crypto.getRandomValues` + rejection sampling (ไม่ bias)

### แผนรองรับการแชร์ในอนาคต
1. เพิ่ม backend ที่เก็บเฉพาะ ciphertext + public key ของผู้ใช้
2. แชร์ vault = derive shared key ด้วย ECDH (private ของเรา + public ของผู้รับ) แล้ว wrap vault key ให้ผู้รับ
3. ผู้รับ unwrap ด้วย private key ของตัวเอง server ไม่มีทางอ่านข้อมูลได้

## โครงสร้าง

```
src/lib/crypto.ts     Argon2id, AES-GCM, key wrapping, identity keypair
src/lib/vault.ts      สร้าง/ปลดล็อกคลัง, CRUD, เปลี่ยนรหัส, สำรอง/กู้คืน
src/lib/db.ts         IndexedDB (เก็บแต่ ciphertext)
src/lib/generator.ts  ตัวสร้างรหัสผ่าน + วัดความแข็งแรง
src/components/       หน้าจอ React
public/sw.js          service worker สำหรับออฟไลน์
```
