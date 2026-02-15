#!/bin/bash
set -e

PANDOC_VERSION="3.5"
BINARIES_DIR="../apps/desktop/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# 检测当前平台
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Downloading Pandoc for $OS $ARCH..."

case "$OS" in
    Darwin)
        if [ "$ARCH" = "arm64" ]; then
            PANDOC_FILE="pandoc-${PANDOC_VERSION}-arm64-macOS.zip"
            OUTPUT_FILE="pandoc"
        else
            PANDOC_FILE="pandoc-${PANDOC_VERSION}-x86_64-macOS.zip"
            OUTPUT_FILE="pandoc-x86_64-apple-darwin"
        fi

        echo "Downloading $PANDOC_FILE..."
        curl -L "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${PANDOC_FILE}" -o /tmp/pandoc.zip

        echo "Extracting to $BINARIES_DIR/$OUTPUT_FILE..."
        unzip -p /tmp/pandoc.zip "pandoc-${PANDOC_VERSION}-arm64/bin/pandoc" > "${BINARIES_DIR}/${OUTPUT_FILE}"
        chmod +x "${BINARIES_DIR}/${OUTPUT_FILE}"
        rm /tmp/pandoc.zip
        ;;
    Linux)
        PANDOC_FILE="pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz"
        OUTPUT_FILE="pandoc-x86_64-unknown-linux-gnu"

        echo "Downloading $PANDOC_FILE..."
        curl -L "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${PANDOC_FILE}" -o /tmp/pandoc.tar.gz

        echo "Extracting to $BINARIES_DIR/$OUTPUT_FILE..."
        tar -xzf /tmp/pandoc.tar.gz -O "pandoc-${PANDOC_VERSION}/bin/pandoc" > "${BINARIES_DIR}/${OUTPUT_FILE}"
        chmod +x "${BINARIES_DIR}/${OUTPUT_FILE}"
        rm /tmp/pandoc.tar.gz
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PANDOC_FILE="pandoc-${PANDOC_VERSION}-windows-x86_64.zip"
        OUTPUT_FILE="pandoc-x86_64-pc-windows-msvc.exe"

        echo "Downloading $PANDOC_FILE..."
        curl -L "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/${PANDOC_FILE}" -o /tmp/pandoc.zip

        echo "Extracting to $BINARIES_DIR/$OUTPUT_FILE..."
        unzip -p /tmp/pandoc.zip "pandoc-${PANDOC_VERSION}/pandoc.exe" > "${BINARIES_DIR}/${OUTPUT_FILE}"
        rm /tmp/pandoc.zip
        ;;
    *)
        echo "Unsupported platform: $OS"
        exit 1
        ;;
esac

echo "✓ Pandoc ${PANDOC_VERSION} downloaded to ${BINARIES_DIR}/${OUTPUT_FILE}"
echo "You can verify with: ${BINARIES_DIR}/${OUTPUT_FILE} --version"
