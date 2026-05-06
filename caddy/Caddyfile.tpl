{
  admin 0.0.0.0:2019 {
    origins localhost:2019 ""
  }
}

:80 {
  handle /api/* {
    uri strip_prefix /api
    reverse_proxy {{ range service "api" }}{{ .Address }}:{{ .Port }}{{ end }}
  }

  handle {
    reverse_proxy {{ range service "web" }}{{ .Address }}:{{ .Port }}{{ end }}
  }
}
