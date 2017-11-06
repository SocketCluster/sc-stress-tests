FROM node:8.4.0-slim

LABEL maintainer="Jonathan Gros-Dubois"
LABEL version="9.1.1"
LABEL description="Docker file for SocketCluster with support for clustering."

RUN mkdir -p /usr/src/
WORKDIR /usr/src/
COPY . /usr/src/

RUN npm install .

EXPOSE 8000

CMD ["npm", "run", "start:docker"]
