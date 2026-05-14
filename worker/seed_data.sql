-- Seed pharmacies (demo data matching original server.js)
INSERT OR IGNORE INTO pharmacies VALUES 
('ph1','City Pharma','45 MG Road, Bengaluru, KA 560001','KAR-PH-2024-001','+91 98765 43210','citypharma@demo.com','ef92b778bafe771e89245b89ecbc08a6153ae4f77abf7c0bc1e4bb5e0c3b282f','1500','2026-12-31',0,'active','2024-01-15','[{"id":"d1","name":"Drug License 2024.pdf","date":"2024-01-15","size":"245 KB"}]','retail',NULL,NULL),
('ph2','HealthPlus Pharmacy','12 Park Street, Kolkata, WB 700016','WB-PH-2024-042','+91 97654 32109','healthplus@demo.com','eb6e3c8d29b60cc1a0d3a4a0c88fc3d85b58b6b20e96f3c85bfe9e41ada1c27d','1000','2026-11-30',0,'active','2024-03-20','[{"id":"d2","name":"Pharmacy License.pdf","date":"2024-03-20","size":"320 KB"}]','retail',NULL,NULL),
('ph3','MediCare Pharma','78 Anna Nagar, Chennai, TN 600040','TN-PH-2024-115','+91 96543 21098','medicare@demo.com','07bcc8dee7e5db5c7edd81c3f890a7a76a3562e98a9b82f00e66c1c9f8a0f0e1',NULL,NULL,0,'pending','2024-06-01','[]','retail',NULL,NULL);

-- Seed drugs
INSERT OR IGNORE INTO drugs VALUES
('g1','ph1','Paracetamol 500mg','Acetaminophen','Analgesic','Sun Pharma','B2024001',500,100,2.50,3.50,'2026-08-01','8901234567890'),
('g2','ph1','Amoxicillin 250mg','Amoxicillin','Antibiotic','Cipla','B2024002',35,50,8.00,12.00,'2026-05-15',''),
('g3','ph1','Metformin 500mg','Metformin HCL','Antidiabetic','Mankind','B2024003',200,80,3.50,5.00,'2027-01-31',''),
('g4','ph1','Atorvastatin 10mg','Atorvastatin','Statin','Dr. Reddys','B2024004',15,60,12.00,18.00,'2026-06-30',''),
('g5','ph1','Omeprazole 20mg','Omeprazole','PPI','Torrent Pharma','B2024005',300,100,4.00,6.00,'2026-04-30',''),
('g6','ph1','Cetirizine 10mg','Cetirizine','Antihistamine','Zydus','B2024006',450,100,1.50,2.50,'2027-03-01',''),
('g7','ph2','Azithromycin 500mg','Azithromycin','Antibiotic','Pfizer','B2024101',80,50,45.00,65.00,'2026-09-30',''),
('g8','ph2','Losartan 50mg','Losartan Potassium','Antihypertensive','Novartis','B2024102',20,40,18.00,25.00,'2026-07-31','');

-- Seed orders
INSERT OR IGNORE INTO orders VALUES
('ORD-001','inventory','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":500,"up":2.50,"tot":1250},{"name":"Metformin 500mg","qty":200,"up":3.50,"tot":700}]',1950,97.50,2047.50,'2026-04-01','delivered','free','',1,'',NULL,NULL),
('ORD-002','inventory','ph2','HealthPlus Pharmacy','[{"name":"Azithromycin 500mg","qty":100,"up":45.00,"tot":4500}]',4500,225,4725,'2026-04-05','approved','paid','',1,'',NULL,NULL),
('ORD-003','inventory','ph1','City Pharma','[{"name":"Amoxicillin 250mg","qty":100,"up":8.00,"tot":800},{"name":"Atorvastatin 10mg","qty":100,"up":12.00,"tot":1200}]',2000,100,2100,'2026-04-10','pending','paid','Urgent',0,'',NULL,NULL),
('ORD-004','customer','ph1','City Pharma','[{"name":"Paracetamol 500mg","qty":10,"up":3.50,"tot":35}]',35,1.75,36.75,'2026-04-12','delivered','','',0,'Priya Sharma',NULL,NULL),
('ORD-005','customer','ph1','City Pharma','[{"name":"Cetirizine 10mg","qty":5,"up":2.50,"tot":12.50}]',12.50,0.63,13.13,'2026-04-14','pending','','',0,'Rahul Verma',NULL,NULL);

-- Seed bills
INSERT OR IGNORE INTO bills VALUES
('BILL-001','ph1','City Pharma','ORD-001',2047.50,'2026-04-01','2026-04-16','paid','bulk','2026-04-05'),
('BILL-002','ph2','HealthPlus Pharmacy','ORD-002',4725,'2026-04-05','2026-04-20','unpaid','bulk',NULL),
('BILL-003','ph1','City Pharma','ORD-003',2100,'2026-04-10','2026-04-25','unpaid','bulk',NULL);

-- Seed returns
INSERT OR IGNORE INTO returns VALUES
('RET-001','ph1','City Pharma','expired','[{"name":"Omeprazole 20mg","qty":100,"batch":"B2023005"}]','2026-04-15','pending','Batch expired before sale',''),
('RET-002','ph2','HealthPlus Pharmacy','wrong','[{"name":"Losartan 50mg","qty":30,"batch":"B2024102"}]','2026-04-16','approved','Wrong drug delivered','Will be replaced');

-- Seed tickets
INSERT OR IGNORE INTO tickets VALUES
('TKT-001','ph1','City Pharma','Payment not reflected','billing','2026-04-14','open','[{"from":"pharmacy","text":"I paid BILL-001 but status still shows unpaid","time":"10:30 AM"}]');

-- Seed notifications
INSERT OR IGNORE INTO notifs VALUES
('n1','order','New order ORD-003 from City Pharma','2026-04-10',0,1,NULL),
('n2','return','Return RET-001 from City Pharma','2026-04-15',0,1,NULL),
('n3','expiry','Omeprazole 20mg expiring soon!','2026-04-19',0,0,'ph1'),
('n4','stock','Atorvastatin 10mg critically low (15 units)','2026-04-19',0,0,'ph1'),
('n5','payment','BILL-003 payment due Apr 25','2026-04-19',0,0,'ph1');

-- Seed chat
INSERT OR IGNORE INTO chats(from_role,text,time) VALUES
('support','Hello! Welcome to PharmaDist Support. How can we help you today?','09:00 AM');

-- Seed products catalog
INSERT OR IGNORE INTO products (id,name,category,price,stock,expiry_date,created_at) VALUES
('prod_seed_01','Paracetamol 500mg Tablets','Analgesic',3.50,500,'2026-12-31','2026-01-01T00:00:00Z'),
('prod_seed_02','Amoxicillin 250mg Capsules','Antibiotic',12.00,200,'2026-09-30','2026-01-01T00:00:00Z'),
('prod_seed_03','Metformin 500mg Tablets','Antidiabetic',5.00,350,'2027-03-15','2026-01-01T00:00:00Z'),
('prod_seed_04','Atorvastatin 10mg Tablets','Statin',18.00,150,'2026-07-31','2026-01-01T00:00:00Z'),
('prod_seed_05','Omeprazole 20mg Capsules','PPI',6.50,80,'2026-05-20','2026-01-01T00:00:00Z'),
('prod_seed_06','Cetirizine 10mg Tablets','Antihistamine',2.50,600,'2027-01-10','2026-01-01T00:00:00Z'),
('prod_seed_07','Azithromycin 500mg Tablets','Antibiotic',65.00,120,'2026-11-30','2026-01-01T00:00:00Z'),
('prod_seed_08','Losartan 50mg Tablets','Antihypertensive',25.00,60,'2026-06-15','2026-01-01T00:00:00Z');

-- Seed dist_stock
INSERT OR IGNORE INTO dist_stock VALUES
('STK-seed01','Paracetamol 500mg','Analgesic','Sun Pharma',2.50,3.50,5000,500,'Strip','2026-12-31','2026-01-01T00:00:00Z'),
('STK-seed02','Amoxicillin 250mg','Antibiotic','Cipla',8.00,12.00,2000,200,'Strip','2026-09-30','2026-01-01T00:00:00Z'),
('STK-seed03','Metformin 500mg','Antidiabetic','Mankind',3.50,5.00,3500,300,'Strip','2027-03-15','2026-01-01T00:00:00Z'),
('STK-seed04','Azithromycin 500mg','Antibiotic','Pfizer',45.00,65.00,800,100,'Strip','2026-11-30','2026-01-01T00:00:00Z');
