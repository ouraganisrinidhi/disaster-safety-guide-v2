CREATE DATABASE IF NOT EXISTS disaster_safety_guide
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE disaster_safety_guide;

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  region_code VARCHAR(8) NOT NULL DEFAULT 'IN',
  service_name VARCHAR(100) NOT NULL,
  number VARCHAR(24) NOT NULL,
  description VARCHAR(180) NOT NULL,
  color_key ENUM('red','blue','green','orange','purple','teal') NOT NULL DEFAULT 'blue',
  source_url VARCHAR(500) NULL,
  verified_at DATE NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_contact_region_number (region_code, number),
  INDEX idx_contacts_region (region_code, active, display_order)
);

CREATE TABLE IF NOT EXISTS content_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_slug VARCHAR(120) NOT NULL,
  language_code CHAR(2) NOT NULL,
  source_name VARCHAR(160) NOT NULL,
  source_url VARCHAR(500) NULL,
  reviewed_at DATE NOT NULL,
  version VARCHAR(30) NOT NULL,
  UNIQUE KEY uq_review (content_slug, language_code, version)
);

CREATE TABLE IF NOT EXISTS disaster_guides (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  category ENUM('natural','weather','human-caused','health') NOT NULL,
  status ENUM('draft','in_review','published','archived') NOT NULL DEFAULT 'draft',
  icon_key VARCHAR(40) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS disaster_translations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  disaster_id BIGINT UNSIGNED NOT NULL,
  language_code CHAR(2) NOT NULL,
  title VARCHAR(160) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  overview TEXT NOT NULL,
  warning_signs JSON NOT NULL,
  before_steps JSON NOT NULL,
  during_steps JSON NOT NULL,
  after_steps JSON NOT NULL,
  dos JSON NOT NULL,
  donts JSON NOT NULL,
  review_status ENUM('draft','translation_review','safety_review','approved') NOT NULL DEFAULT 'draft',
  UNIQUE KEY uq_disaster_language (disaster_id, language_code),
  CONSTRAINT fk_disaster_translation FOREIGN KEY (disaster_id) REFERENCES disaster_guides(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS first_aid_guides (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  status ENUM('draft','in_review','published','archived') NOT NULL DEFAULT 'draft',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS first_aid_translations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_aid_id BIGINT UNSIGNED NOT NULL,
  language_code CHAR(2) NOT NULL,
  title VARCHAR(160) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  immediate_steps JSON NOT NULL,
  avoid_steps JSON NOT NULL,
  urgent_guidance TEXT NOT NULL,
  review_status ENUM('draft','translation_review','medical_review','approved') NOT NULL DEFAULT 'draft',
  UNIQUE KEY uq_first_aid_language (first_aid_id, language_code),
  CONSTRAINT fk_first_aid_translation FOREIGN KEY (first_aid_id) REFERENCES first_aid_guides(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kit_template_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_key VARCHAR(80) NOT NULL,
  item_key VARCHAR(100) NOT NULL,
  language_code CHAR(2) NOT NULL,
  label_text VARCHAR(180) NOT NULL,
  detail_text VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_kit_translation (item_key, language_code)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_slug VARCHAR(120) NOT NULL,
  difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
  language_code CHAR(2) NOT NULL,
  prompt_text VARCHAR(1000) NOT NULL,
  explanation_text VARCHAR(1500) NOT NULL,
  status ENUM('draft','in_review','published','archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_options (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_quiz_option FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version_code VARCHAR(30) NOT NULL UNIQUE,
  notes VARCHAR(1000) NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_type ENUM('incorrect-information','outdated-contact','translation','accessibility','other') NOT NULL,
  message_text TEXT NOT NULL,
  page_url VARCHAR(300) NULL,
  status ENUM('new','reviewing','resolved','rejected') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  INDEX idx_feedback_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(160) NOT NULL,
  action_name VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(24) NULL,
  password_hash VARCHAR(100) NOT NULL,
  preferred_language ENUM('en','te','hi') NOT NULL DEFAULT 'en',
  account_status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_status (account_status)
);

INSERT INTO emergency_contacts
  (region_code, service_name, number, description, color_key, source_url, verified_at, display_order)
VALUES
  ('IN', 'National Emergency', '112', 'Integrated emergency assistance', 'red', 'https://112.gov.in/', '2026-09-30', 1),
  ('IN', 'Police', '100', 'Law and order assistance', 'blue', 'https://www.india.gov.in/directory/helpline', '2026-09-30', 2),
  ('IN', 'Ambulance', '108', 'Emergency medical transport where available', 'green', 'https://112.gov.in/about', '2026-09-30', 3),
  ('IN', 'Fire & Rescue', '101', 'Fire and rescue service', 'orange', 'https://www.india.gov.in/directory/helpline', '2026-09-30', 4),
  ('IN', 'Women Helpline', '181', 'Support for women in distress', 'purple', 'https://www.india.gov.in/directory/helpline', '2026-09-30', 5),
  ('IN', 'Child Helpline', '1098', 'Support for children in need', 'teal', 'https://www.india.gov.in/directory/helpline', '2026-09-30', 6)
ON DUPLICATE KEY UPDATE service_name = VALUES(service_name);

INSERT INTO content_versions (version_code, notes, active)
VALUES ('1.0.0', 'Initial offline content bundle', TRUE)
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
