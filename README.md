# Hyper Blackbox Exporter

A prometheus exporter to get basic metrics about hypercores. It uses the [multi-exporter pattern](https://prometheus.io/docs/guides/multi-target-exporter/).

Includes metrics:
- `hyper_probe_success`: whether a hypercore can be located and its first block downloaded
- `hyper_probe_duration_seconds`: how long it takes to locate the hypercore and download the first block
- `hyper_probe_nr_peers`: how many peers are serving this block (this is an underbound, the server might not connect to all of them)
## Install

`npm i -g hyper-blackbox-exporter`

## Usage

Note: can also be run as Docker, see [here](https://hub.docker.com/r/hdegroote/hyper-blackbox-exporter).

CLI usage:

`hyper-blackbox-exporter`

Then from another terminal:

`curl http://127.0.0.1:43211/probe?target=<key>`

For example:
curl http://127.0.0.1:43211/probe?target=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

Output example:
```
# HELP hyper_probe_duration_seconds Returns how long the probe took to complete in seconds
# TYPE hyper_probe_duration_seconds gauge
hyper_probe_duration_seconds 0.011095994994044303
# HELP hyper_probe_success Displays whether or not the probe was a success
# TYPE hyper_probe_success gauge
hyper_probe_success 1
# HELP hyper_probe_nr_peers Displays the number of peers who are serving this core
# TYPE hyper_probe_nr_peers gauge
hyper_probe_nr_peers 7
```

## Prometheus Config

This endpoint can be scraped with the following config, entering your own hypercore keys under targets and replacing the `__address__` entry with the URL to your hyper-blackbox-exporter's URL.

```
  - job_name: hyperblackbox-exporter
    metrics_path: /probe
    scheme: https
    scrape_timeout: 10s
    scrape_interval: 60s
    static_configs:
      - targets:
        - aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
        - bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: hypercoreKey
      - target_label: __address__
        replacement: myUrl:8080
```
