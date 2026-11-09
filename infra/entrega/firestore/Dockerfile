# Emulador de Firestore (Clínica odontológica, institución 4) para la entrega.
# Imagen oficial de Java (Eclipse Temurin) + el JAR oficial del emulador publicado por Google,
# en la misma versión que fija firebase-tools 14.22.0 (lib/emulator/downloadableEmulatorInfo.json)
# y verificado por SHA-256. No necesita npm ni credenciales; el JAR se descarga al construir.
FROM eclipse-temurin:17-jre

ARG EMULADOR_VERSION=1.19.8
ARG EMULADOR_SHA256=9d43599ed6151199e8d604dc87fac51218e49e5f3a48519b1ae560bbe5e3382d
RUN curl -fsSL -o /opt/firestore-emulator.jar \
    "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v${EMULADOR_VERSION}.jar" \
  && echo "${EMULADOR_SHA256}  /opt/firestore-emulator.jar" | sha256sum -c -

COPY iniciar.sh /opt/iniciar.sh
RUN chmod 755 /opt/iniciar.sh

EXPOSE 8080
VOLUME ["/data"]
CMD ["/opt/iniciar.sh"]
