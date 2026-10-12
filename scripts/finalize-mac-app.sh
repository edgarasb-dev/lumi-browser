#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Lumi.app"
APP_SRC="dist.nosync/mac-arm64/${APP_NAME}"
TMP_APP="/tmp/${APP_NAME}"

if [ ! -d "${APP_SRC}" ]; then
  echo "Error: ${APP_SRC} not found"
  exit 1
fi

echo "Staging ${APP_NAME} to /tmp for code signing..."
rm -rf "${TMP_APP}"
cp -R "${APP_SRC}" "${TMP_APP}"

echo "Cleaning detritus and removing provisioning profile..."
rm -f "${TMP_APP}/Contents/embedded.provisionprofile"
xattr -crs "${TMP_APP}"

echo "Signing ${APP_NAME}..."
codesign --force --deep --sign - "${TMP_APP}"

echo "Moving signed ${APP_NAME} to dist.nosync..."
rm -rf "${APP_SRC}"
mv "${TMP_APP}" "${APP_SRC}"

echo "Creating dist symlink..."
test -L dist || ln -sfn dist.nosync dist

codesign -v "dist/mac-arm64/${APP_NAME}"
echo "Successfully signed and staged ${APP_NAME} in dist/mac-arm64!"
