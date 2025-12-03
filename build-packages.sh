#!/bin/bash
# PathFinder - Script de Compilation des Packages d'Installation
# Usage: ./build-packages.sh [macos|android|windows|all]

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAUI_DIR="$PROJECT_DIR/PathFinderMAUI"
DOWNLOADS_DIR="$PROJECT_DIR/PathFinderWeb/downloads"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 PathFinder - Build Packages${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifications préalables
echo -e "${YELLOW}🔍 Vérifications...${NC}"

# Vérifier dotnet
if ! command -v dotnet &> /dev/null; then
    echo -e "${RED}❌ dotnet n'est pas installé ou pas dans le PATH${NC}"
    echo "Installation: https://dotnet.microsoft.com/download"
    exit 1
fi

echo -e "${GREEN}✅ dotnet $(dotnet --version)${NC}"

# Vérifier workloads MAUI
if ! dotnet workload list | grep -q "maui"; then
    echo -e "${RED}❌ Workload .NET MAUI non installé${NC}"
    echo "Installation: dotnet workload install maui"
    exit 1
fi

echo -e "${GREEN}✅ Workload MAUI installé${NC}"
echo ""

# Créer le dossier downloads si nécessaire
mkdir -p "$DOWNLOADS_DIR"

# Fonction: Build macOS
build_macos() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🍎 Build macOS (Mac Catalyst)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$MAUI_DIR"
    
    echo "📦 Compilation pour Mac Catalyst..."
    dotnet publish -f net8.0-maccatalyst -c Release -p:RuntimeIdentifier=maccatalyst-arm64
    
    # Trouver le .app
    APP_PATH=$(find bin/Release/net8.0-maccatalyst -name "*.app" -type d | head -1)
    
    if [ -z "$APP_PATH" ]; then
        echo -e "${RED}❌ Aucun .app trouvé${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Application compilée: $APP_PATH${NC}"
    
    # Créer le DMG
    echo "📦 Création du DMG..."
    DMG_OUTPUT="$DOWNLOADS_DIR/PathFinder-macOS.dmg"
    
    rm -f "$DMG_OUTPUT"
    hdiutil create -volname "PathFinder" \
                   -srcfolder "$APP_PATH" \
                   -ov \
                   -format UDZO \
                   "$DMG_OUTPUT"
    
    if [ -f "$DMG_OUTPUT" ]; then
        SIZE=$(du -h "$DMG_OUTPUT" | cut -f1)
        echo -e "${GREEN}✅ DMG créé: $SIZE${NC}"
        echo "   → $DMG_OUTPUT"
    else
        echo -e "${RED}❌ Échec création DMG${NC}"
        return 1
    fi
    
    echo ""
}

# Fonction: Build Android
build_android() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🤖 Build Android APK${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$MAUI_DIR"
    
    # Vérifier Java
    if ! command -v keytool &> /dev/null; then
        echo -e "${YELLOW}⚠️  Java/keytool non trouvé${NC}"
        echo "Build APK non signé..."
        
        dotnet publish -f net8.0-android -c Release -p:AndroidPackageFormat=apk
        
        APK_FILE=$(find bin/Release/net8.0-android -name "*.apk" -type f | head -1)
        
        if [ -z "$APK_FILE" ]; then
            echo -e "${RED}❌ Aucun APK trouvé${NC}"
            return 1
        fi
        
        cp "$APK_FILE" "$DOWNLOADS_DIR/PathFinder-Android.apk"
        SIZE=$(du -h "$DOWNLOADS_DIR/PathFinder-Android.apk" | cut -f1)
        echo -e "${GREEN}✅ APK créé (non signé): $SIZE${NC}"
        echo -e "${YELLOW}   ⚠️  Pour un APK signé, installez Java et créez une keystore${NC}"
        return 0
    fi
    
    # Créer keystore si n'existe pas
    KEYSTORE="pathfinder.keystore"
    STORE_PASS="pathfinder123"
    KEY_ALIAS="pathfinder"
    
    if [ ! -f "$KEYSTORE" ]; then
        echo "🔑 Création de la keystore..."
        keytool -genkey -v \
            -keystore "$KEYSTORE" \
            -alias "$KEY_ALIAS" \
            -keyalg RSA \
            -keysize 2048 \
            -validity 10000 \
            -storepass "$STORE_PASS" \
            -keypass "$STORE_PASS" \
            -dname "CN=PathFinder, OU=Security, O=PathFinder, L=Paris, ST=IDF, C=FR"
        
        echo -e "${GREEN}✅ Keystore créée${NC}"
    fi
    
    echo "📦 Compilation APK signé..."
    dotnet publish -f net8.0-android -c Release \
        -p:AndroidPackageFormat=apk \
        -p:AndroidKeyStore=true \
        -p:AndroidSigningKeyStore="./$KEYSTORE" \
        -p:AndroidSigningStorePass="$STORE_PASS" \
        -p:AndroidSigningKeyAlias="$KEY_ALIAS" \
        -p:AndroidSigningKeyPass="$STORE_PASS"
    
    # Trouver l'APK signé
    APK_FILE=$(find bin/Release/net8.0-android -name "*-Signed.apk" -type f | head -1)
    
    if [ -z "$APK_FILE" ]; then
        # Essayer APK non signé
        APK_FILE=$(find bin/Release/net8.0-android -name "*.apk" -type f | head -1)
    fi
    
    if [ -z "$APK_FILE" ]; then
        echo -e "${RED}❌ Aucun APK trouvé${NC}"
        return 1
    fi
    
    cp "$APK_FILE" "$DOWNLOADS_DIR/PathFinder-Android.apk"
    SIZE=$(du -h "$DOWNLOADS_DIR/PathFinder-Android.apk" | cut -f1)
    echo -e "${GREEN}✅ APK créé: $SIZE${NC}"
    echo "   → $DOWNLOADS_DIR/PathFinder-Android.apk"
    echo ""
}

# Fonction: Build Windows
build_windows() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🪟 Build Windows (Win 10/11)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    cd "$MAUI_DIR"
    
    # Vérifier si on est sur macOS (build cross-platform limité)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}⚠️  Build Windows depuis macOS - Package non-signé${NC}"
        echo ""
        
        # Tentative de build pour Windows (fichiers non-packagés)
        echo "📦 Compilation pour Windows x64..."
        
        # Build la version Windows (DLL/EXE)
        dotnet publish -f net8.0-windows10.0.19041.0 -c Release \
            -p:RuntimeIdentifier=win10-x64 \
            -p:SelfContained=true \
            -p:PublishSingleFile=true \
            -p:IncludeNativeLibrariesForSelfExtract=true 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Build MSIX échoué (normal depuis macOS)${NC}"
            echo ""
            echo "Alternative: Build fichiers standalone..."
            
            # Build simple sans packaging
            dotnet build -f net8.0-windows10.0.19041.0 -c Release 2>/dev/null || {
                echo -e "${RED}❌ Impossible de compiler pour Windows depuis macOS${NC}"
                echo ""
                echo -e "${BLUE}📝 Pour créer le package Windows complet:${NC}"
                echo ""
                echo "Option 1 - Sur une machine Windows:"
                echo "  dotnet publish -f net8.0-windows10.0.19041.0 -c Release \\"
                echo "    -p:WindowsPackageType=Msix \\"
                echo "    -p:AppxBundle=Always \\"
                echo "    -p:GenerateAppxPackageOnBuild=true"
                echo ""
                echo "Option 2 - Avec Visual Studio sur Windows:"
                echo "  1. Ouvrir PathFinder.csproj"
                echo "  2. Clic droit → Publish"
                echo "  3. Create App Packages"
                echo "  4. Sélectionner: Sideloading"
                echo "  5. Windows 10/11 (x64, ARM64)"
                echo ""
                echo "Le fichier .msix sera dans bin/Release/..."
                echo "Copier ensuite vers PathFinderWeb/downloads/PathFinder-Windows.msix"
                echo ""
                return 1
            }
        }
        
        # Chercher l'exécutable publié
        WIN_EXE=$(find bin/Release/net8.0-windows10.0.19041.0/win10-x64/publish -name "PathFinder.exe" -type f 2>/dev/null | head -1)
        
        if [ -n "$WIN_EXE" ]; then
            # Copier l'exe standalone
            cp "$WIN_EXE" "$DOWNLOADS_DIR/PathFinder-Windows.exe"
            SIZE=$(du -h "$DOWNLOADS_DIR/PathFinder-Windows.exe" | cut -f1)
            echo -e "${GREEN}✅ EXE Windows créé: $SIZE${NC}"
            echo "   → $DOWNLOADS_DIR/PathFinder-Windows.exe"
            echo ""
            echo -e "${YELLOW}⚠️  Note: EXE standalone (non-packagé MSIX)${NC}"
            echo "   Pour un package MSIX complet, compiler sur Windows"
            echo ""
        else
            echo -e "${RED}❌ Aucun exécutable Windows trouvé${NC}"
            return 1
        fi
        
    else
        # Sur Windows natif
        echo "📦 Compilation MSIX pour Windows 10/11..."
        
        # Build package MSIX complet
        dotnet publish -f net8.0-windows10.0.19041.0 -c Release \
            -p:WindowsPackageType=Msix \
            -p:AppxBundle=Always \
            -p:GenerateAppxPackageOnBuild=true \
            -p:RuntimeIdentifier=win10-x64 \
            -p:WindowsAppSDKSelfContained=true
        
        # Trouver le package MSIX
        MSIX_FILE=$(find bin/Release/net8.0-windows10.0.19041.0/win10-x64 -name "*.msix" -type f | head -1)
        
        if [ -z "$MSIX_FILE" ]; then
            # Essayer .appxbundle
            MSIX_FILE=$(find bin/Release/net8.0-windows10.0.19041.0 -name "*.msixbundle" -type f | head -1)
        fi
        
        if [ -n "$MSIX_FILE" ]; then
            cp "$MSIX_FILE" "$DOWNLOADS_DIR/PathFinder-Windows.msix"
            SIZE=$(du -h "$DOWNLOADS_DIR/PathFinder-Windows.msix" | cut -f1)
            echo -e "${GREEN}✅ Package Windows créé: $SIZE${NC}"
            echo "   → $DOWNLOADS_DIR/PathFinder-Windows.msix"
            echo ""
            echo "Installation sur Windows 10/11:"
            echo "  1. Double-cliquer PathFinder-Windows.msix"
            echo "  2. Ou: Add-AppxPackage PathFinder-Windows.msix"
            echo ""
        else
            echo -e "${RED}❌ Aucun package MSIX trouvé${NC}"
            return 1
        fi
    fi
}

# Parser les arguments
BUILD_TARGET="${1:-all}"

case $BUILD_TARGET in
    macos)
        build_macos
        ;;
    android)
        build_android
        ;;
    windows)
        build_windows
        ;;
    all)
        build_macos
        build_android
        build_windows
        ;;
    *)
        echo "Usage: $0 [macos|android|windows|all]"
        exit 1
        ;;
esac

# Résumé
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Build terminé !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📦 Fichiers dans downloads/:"
ls -lh "$DOWNLOADS_DIR" | grep -v "^d" | grep -E "\.(dmg|apk|exe|msix)" || echo "   (aucun package trouvé)"
echo ""
echo "🚀 Redémarre le serveur Flask pour rendre les nouveaux fichiers disponibles:"
echo "   cd PathFinderWeb/backend"
echo "   pkill -f 'python3 app.py'"
echo "   python3 app.py &"
echo ""

