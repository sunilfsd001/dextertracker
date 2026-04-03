DROP DATABASE IF EXISTS coding_tracker;
CREATE DATABASE coding_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coding_tracker;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE problems (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  difficulty ENUM('easy', 'medium', 'hard') NOT NULL,
  topic VARCHAR(100) NOT NULL,
  reference_url VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_problems_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_problems_topic (topic),
  INDEX idx_problems_difficulty (difficulty)
) ENGINE=InnoDB;

CREATE TABLE daily_problems (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  problem_date DATE NOT NULL,
  problem_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_daily_problems_date UNIQUE (problem_date),
  CONSTRAINT fk_daily_problem_problem
    FOREIGN KEY (problem_id) REFERENCES problems(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_daily_problem_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_daily_problems_problem_id (problem_id),
  INDEX idx_daily_problems_created_by (created_by)
) ENGINE=InnoDB;

CREATE TABLE notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  INDEX idx_notes_user_id (user_id),
  INDEX idx_notes_user_updated_at (user_id, updated_at)
) ENGINE=InnoDB;

CREATE TABLE user_completions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  daily_problem_id BIGINT UNSIGNED NOT NULL,
  completion_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_completion_per_day UNIQUE (user_id, completion_date),
  CONSTRAINT uq_user_completion_problem UNIQUE (user_id, daily_problem_id),
  CONSTRAINT fk_user_completions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_user_completions_daily_problem
    FOREIGN KEY (daily_problem_id) REFERENCES daily_problems(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_user_completions_date (completion_date),
  INDEX idx_user_completions_user_date (user_id, completion_date),
  INDEX idx_user_completions_daily_problem_id (daily_problem_id)
) ENGINE=InnoDB;
