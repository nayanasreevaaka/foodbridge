CREATE DATABASE IF NOT EXISTS foodbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE foodbridge;

CREATE TABLE IF NOT EXISTS food_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(140) NOT NULL,
  category ENUM('Cooked meals','Bakery','Fruits & vegetables','Packaged food','Other') NOT NULL DEFAULT 'Cooked meals',
  description VARCHAR(500) NOT NULL,
  quantity INT NOT NULL,
  unit ENUM('meals','kg','boxes','items') NOT NULL DEFAULT 'meals',
  expiry_at DATETIME NOT NULL,
  pickup_address VARCHAR(255) NOT NULL,
  donor_name VARCHAR(140) NOT NULL,
  donor_contact VARCHAR(80) NOT NULL,
  status ENUM('available','reserved','collected','expired') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing_status (status), INDEX idx_expiry (expiry_at)
);

CREATE TABLE IF NOT EXISTS pickup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT NOT NULL,
  organization_name VARCHAR(140) NOT NULL,
  contact VARCHAR(80) NOT NULL,
  quantity INT NOT NULL,
  notes VARCHAR(500) DEFAULT '',
  status ENUM('pending','confirmed','collected','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_request_listing FOREIGN KEY (listing_id) REFERENCES food_listings(id) ON DELETE CASCADE,
  INDEX idx_request_status (status)
);

INSERT INTO food_listings (title, category, description, quantity, unit, expiry_at, pickup_address, donor_name, donor_contact)
SELECT 'Fresh vegetarian lunch boxes','Cooked meals','Freshly prepared rice, dal and vegetable curry. Packed separately.',45,'meals',DATE_ADD(NOW(), INTERVAL 5 HOUR),'MG Road, Vijayawada','Green Leaf Restaurant','Contact through platform'
WHERE NOT EXISTS (SELECT 1 FROM food_listings WHERE title='Fresh vegetarian lunch boxes');
INSERT INTO food_listings (title, category, description, quantity, unit, expiry_at, pickup_address, donor_name, donor_contact)
SELECT 'Bakery surplus','Bakery','Sealed bread rolls and buns from today’s batch.',24,'boxes',DATE_ADD(NOW(), INTERVAL 8 HOUR),'Benz Circle, Vijayawada','Daily Crust Bakery','Contact through platform'
WHERE NOT EXISTS (SELECT 1 FROM food_listings WHERE title='Bakery surplus');
INSERT INTO food_listings (title, category, description, quantity, unit, expiry_at, pickup_address, donor_name, donor_contact)
SELECT 'Seasonal fruit boxes','Fruits & vegetables','Fresh bananas, apples and oranges; inspect at pickup.',18,'boxes',DATE_ADD(NOW(), INTERVAL 20 HOUR),'Governorpet, Vijayawada','Harvest Market','Contact through platform'
WHERE NOT EXISTS (SELECT 1 FROM food_listings WHERE title='Seasonal fruit boxes');
