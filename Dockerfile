FROM christophwitzko/kue-ui
RUN apk update && apk add curl
COPY . .