/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface AppInternalErrsErrorResponse {
  details?: Record<string, any>;
  error_key: string;
  message?: string;
  status: number;
  timestamp?: string;
}

export interface AppInternalErrsValidationErrorResponse {
  error_key: string;
  errors: Record<string, string[]>;
  message: string;
}

export interface InternalAuthForgotPasswordRequest {
  email: string;
}

export interface InternalAuthLoginDataResponse {
  data: InternalAuthLoginResponse;
}

export interface InternalAuthLoginRequest {
  email: string;
  password: string;
}

export interface InternalAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  user: InternalAuthUserResponse;
}

export interface InternalAuthRefreshTokenDataResponse {
  data: InternalAuthRefreshTokenResponse;
}

export interface InternalAuthRefreshTokenRequest {
  refresh_token: string;
}

export interface InternalAuthRefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface InternalAuthRegisterDataResponse {
  data: InternalAuthRegisterResponse;
}

export interface InternalAuthRegisterRequest {
  email: string;
  name: string;
  /** @minLength 6 */
  password: string;
}

export interface InternalAuthRegisterResponse {
  access_token: string;
  refresh_token: string;
  user: InternalAuthUserResponse;
}

export interface InternalAuthResetPasswordRequest {
  /** @minLength 8 */
  password: string;
  token: string;
}

export interface InternalAuthUpdatePasswordRequest {
  current_password: string;
  /** @minLength 8 */
  new_password: string;
}

export interface InternalAuthUpdateProfileRequest {
  email: string;
  name: string;
}

export interface InternalAuthUserDataResponse {
  data: InternalAuthUserResponse;
}

export interface InternalAuthUserResponse {
  email: string;
  email_verified: boolean;
  id: number;
  name: string;
  roles: string[];
}

export interface InternalAuthVerifyEmailRequest {
  token: string;
}

export interface InternalMessageData {
  message: string;
}

export interface InternalMessageResponse {
  data: InternalMessageData;
}

export interface InternalPaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface InternalStoragesGCSConfig {
  bucket: string;
  prefix: string;
}

export interface InternalStoragesGCSInput {
  bucket: string;
  credentials_json?: string;
  prefix?: string;
}

export type InternalStoragesKind = "local" | "s3" | "gcs";

export interface InternalStoragesLocalConfig {
  path: string;
}

export interface InternalStoragesLocalInput {
  path: string;
}

export interface InternalStoragesObjectResponse {
  is_dir: boolean;
  modified_at?: string;
  name: string;
  size: number;
}

export interface InternalStoragesObjectsResponse {
  data: InternalStoragesObjectResponse[];
}

export interface InternalStoragesPaginatedStoragesResponse {
  data: InternalStoragesStorageResponse[];
  pagination: InternalPaginationMeta;
}

export interface InternalStoragesS3Config {
  bucket: string;
  endpoint: string;
  prefix: string;
  region: string;
  use_path_style: boolean;
}

export interface InternalStoragesS3Input {
  access_key_id?: string;
  bucket: string;
  endpoint?: string;
  prefix?: string;
  region?: string;
  secret_access_key?: string;
  use_path_style?: boolean;
}

export interface InternalStoragesStorageDataResponse {
  data: InternalStoragesStorageResponse;
}

export interface InternalStoragesStorageRequest {
  s3?: InternalStoragesS3Input;
  gcs?: InternalStoragesGCSInput;
  kind: "local" | "s3" | "gcs";
  local?: InternalStoragesLocalInput;
  /** @maxLength 100 */
  name: string;
}

export interface InternalStoragesStorageResponse {
  s3?: InternalStoragesS3Config;
  created_at: string;
  gcs?: InternalStoragesGCSConfig;
  id: number;
  kind: "local" | "s3" | "gcs";
  local?: InternalStoragesLocalConfig;
  name: string;
  secret_set: boolean;
  updated_at: string;
}

export interface InternalStoragesTestResultDataResponse {
  data: InternalStoragesTestResultResponse;
}

export interface InternalStoragesTestResultResponse {
  error?: string;
  ok: boolean;
  step?: "connect" | "write" | "read" | "delete";
}

export interface InternalUsersCreateUserRequest {
  email: string;
  name: string;
  /** @minLength 8 */
  password: string;
  role: "super-admin" | "admin" | "user";
}

export interface InternalUsersPaginatedUsersResponse {
  data: InternalUsersUserResponse[];
  pagination: InternalPaginationMeta;
}

export interface InternalUsersSetPasswordRequest {
  /** @minLength 8 */
  password: string;
}

export interface InternalUsersUpdateUserRequest {
  email: string;
  name: string;
}

export interface InternalUsersUserDataResponse {
  data: InternalUsersUserResponse;
}

export interface InternalUsersUserResponse {
  created_at: string;
  email: string;
  email_verified: boolean;
  id: number;
  name: string;
  roles: string[];
  updated_at: string;
}
