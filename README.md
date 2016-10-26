# kued

Dockerized kue for managing REST-tasks.
Uses:

* https://github.com/Automattic/kue
* https://github.com/stonecircle/kue-ui
* https://github.com/christophwitzko/docker-kue-ui

Adds:

* POST /api/rest-job/:jobtype - creates new job of type :jobtype, which calls body.jobTargetUrl, and returns when finished

