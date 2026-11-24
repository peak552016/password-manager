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

### ติดตั้งเป็นแอพบน Windows (Edge / Chrome)
1. push ขึ้น GitHub แล้วเปิด Settings → Pages → Source: **GitHub Actions**
   (workflow `.github/workflows/deploy.yml` จะ test + build + deploy ให้ทุกครั้งที่ push `main`)
2. เปิด `https://<user>.github.io/<repo>/` ใน Edge
3. เมนู `…` → Apps → **Install this site as an app** แล้วติ๊ก “สร้างทางลัดบนเดสก์ท็อป”
4. จากนั้นกดไอคอน Vault บนเดสก์ท็อปได้เลย เปิดเป็นหน้าต่างแยก ใช้ออฟไลน์ได้

ข้อมูลเก็บอยู่ใน profile ของเบราว์เซอร์บนเครื่องนั้น (IndexedDB) ไม่ถูกส่งขึ้น GitHub
ถ้าล้างข้อมูลเบราว์เซอร์หรือถอนแอพ ข้อมูลจะหาย จึงควรกด “ส่งออกไฟล์สำรอง” เป็นระยะ

### ติดตั้งบน iPhone
เปิด URL เดียวกันใน Safari → ปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม”
(แต่ละเครื่องมีคลังแยกกัน ย้ายข้อมูลด้วยไฟล์สำรอง)

## ประเภทรายการ

เลือกประเภทก่อน แล้วฟอร์มจะแสดงเฉพาะช่องที่เกี่ยวข้อง (กำหนดไว้ใน `src/lib/types.ts`)

| ประเภท | ช่องหลัก |
|---|---|
| Login เว็บไซต์ | ชื่อผู้ใช้, รหัสผ่าน (มีตัวสร้าง), เว็บไซต์ |
| API Credentials | Key, Client ID, Client Secret, Endpoint |
| Token | Token, ประเภท, Scope, วันหมดอายุ (เตือนก่อนหมด) |
| cURL / Request | คำสั่ง curl ทั้งก้อน, ใช้ทำอะไร |
| Database | ชนิด, Host, Port, DB, User, Password, Connection string |
| Server / SSH | Host, Port, User, Password, Private key |
| Environment Variables | เนื้อหาไฟล์ .env, โปรเจกต์ |
| Secure Note | ข้อความลับ |

ทุกประเภทมี **Environment** (DEV / SIT / UAT / NON-PROD / PRE-PROD / PROD หรือพิมพ์เอง) ประเภทเชิงเทคนิคมี **Link Knowledge** ด้วย
ทุกประเภทเพิ่มฟิลด์เองได้ และปักเป็นรายการโปรดได้

คีย์ลัด: `Ctrl K` ค้นหา · `Ctrl N` รายการใหม่ · `Ctrl L` ล็อก

## นำเข้าจากโปรแกรมอื่น (แถบซ้าย → นำเข้า)

- **DBeaver:** เลือกโฟลเดอร์ `%APPDATA%\DBeaverData\workspace6` เพื่อดึงทุกโปรเจกต์ หรือเลือก `data-sources.json` + `credentials-config.json` ทีละโปรเจกต์ (`workspace6\<project>\.dbeaver`)
  แอพถอดรหัส credentials ด้วย key มาตรฐานของ DBeaver ในเบราว์เซอร์ แล้วสร้างรายการ Database (host, port, database, user, password)
  ถ้าตั้ง master password ใน DBeaver ไว้จะถอดรหัสไม่ได้
- **Postman:** export Collection (v2.1) และ Environment แล้วเลือกพร้อมกัน ทุก request กลายเป็นรายการ cURL
  (รวม auth ที่สืบทอดจาก folder/collection) environment กลายเป็นรายการ .env และเลือกแทนค่า `{{ตัวแปร}}` ด้วย environment ได้
  Postman ส่งออกเฉพาะ Initial value
- Environment ถูกเดาจากชื่อ เช่น `customer - UAT`, `kyc - pre`, `ekyc SIT` (`src/lib/importers.ts`)

## แชร์ให้คนอื่น

- **ส่งออกเพื่อแชร์** (แถบซ้ายล่าง หรือปุ่มแชร์ในหน้ารายการ): เลือกรายการ ตั้งชื่อชุด แล้วได้ไฟล์ `vault-share-….json` กับรหัสแชร์
- **นำเข้าไฟล์แชร์**: ผู้รับเปิดไฟล์ด้วยรหัสแชร์ ดูรายการก่อน แล้วเลือกเพิ่มลงคลังของตัวเอง (รายการที่ชื่อ/ประเภท/Environment ซ้ำจะไม่ถูกเลือกไว้)
- ไฟล์แชร์เข้ารหัสด้วย Argon2id(รหัสแชร์) → AES-256-GCM แยกจาก master password ทั้งหมด (`src/lib/share.ts`)
- ส่งไฟล์กับรหัสแชร์คนละช่องทางเสมอ

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
