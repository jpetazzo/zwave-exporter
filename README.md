# zwave-exporter

A Prometheus exporter for Z-Wave sensors.

I wrote this to expose the value of Z-Wave air sensors (temperature,
humidity, CO2...) so that I could scrape them with Prometheus and
display them with Grafana.

There is at least another project doing this: [zwave-prometheus-exporter].

- zwave-exporter:
  - automatically exposes metrics for all detected sensors
  - doesn't require per-sensor or per-metric configuration
  - doesn't support S0/S2 security
- zwave-prometheus-exporter:
  - requires to write a metrics.json file to map metrics
  - supports S0/S2 security
  - doesn't seem to support insecure networks (without S0/S2 security)

## Disclaimer

This is my first project using Z-Wave, and I rarely write Node.js code.
I don't know what I'm doing, so if you see any glaring issue, feel free
to let me know, but don't expect miracles! 😅

(In particular, the mix of old-style async code and promises is probably
very wrong, but I'm not sure how it should be done. It seems to work,
although there seems to be a memory leak, too, so...🤷🏻)

## Requirements & quick start

You need a Z-Wave controller supported by [zwave-js]. I personally use
a [UZB] stick plugged into a Raspberry Pi. On my Pi, it shows up at
`/dev/ttyACM0`.

You also need some Z-Wave sensors. I use a couple of [Eurotronic air quality
sensors][eurotronic]. At the moment, I'm not convinced by these sensors,
as they return inconsistent data (see this [Twitter thread][thread] for
details and for some interesting suggestions from other folks who seem
to have way more experience with this than I do!).

You need to "include" these sensors in your Z-Wave network (kind of
"pair" them with your Z-Wave controller). I am embarrassed to admit
that I *don't remember how I did this* the first time.

If I remember well, all that
is required is to switch the Z-Wave controller into "inclusion mode",
then press the inclusion button on the sensors, and *voilà*. I just
can't remember how I switched the controller to inclusion mode.

When I got new sensors, I wrote the little inclusion.js script in
this repo. It should switch the Z-Wave controller to inclusion mode.

To run the exporter:

1. Clone this repo
2. Run `npm install` to install dependencies
3. If your Z-Wave controller is on something else than `/dev/ttyACM0`,
   then `export ZWAVE_DEVICE=/dev/whereveryourcontrolleris`
4. `node exporter.js

After a minute or so, you should be able to `curl localhost:9026/metrics`
and see some Prometheus metrics.

Then you can e.g.:

- start the exporter automatically with systemd or whatever
- add the exporter to your Prometheus configuration
- etc.

## Configuration

The code uses the following environment variables.

- `LOGLEVEL` can be set to any of the standard Node log levels,
  like `info`, `warn`, `debug`... If it isn't set, it will default
  to `warn` (because the Z-Wave driver is otherwise very verbose).
- `METRICS_PORT` defaults to 9026.
- `TIMESTAMPS` can be set to `yes`, `1`, ... if you want timestamps
  in the logging output.
- `ZWAVE_DEVICE` can be set to the path to your Z-Wave controller.
  It default to `/dev/ttyACM0`.
- `ZWAVE_INTERVAL` indictes how often to refresh the values from
  the sensors. By default, it will refresh every 60 seconds.
  If it's set to 0, then it won't actively refresh the values,
  but will still receive updates passively.

## FAQ

**Why Node?**

Yes, why? I initially tried the Python bindings for openzwave, and
I had a bad time. I don't know if it's because openzwave is bad, or
because the bindings are bad, or because I was building on a Raspberry
Pi, or because I lost my touch with obscure Python bindings; but
eventually I tried the [zwave-js] library and it worked immediately,
so here we are.

**Can you help me to...**

No. This is my first project using Z-Wave, and I'm just discovering
this tech stack. Node is not my main language (not even the 3rd or 4th).
I can't help you with this code, sorry! It's provided just in case it's
helpful to anyone else.

[eurotronic]: https://eurotronic.org/produkte/sensoren/luftguetesensor/
[thread]: https://twitter.com/jpetazzo/status/1574672797867163649
[UZB]: https://z-wave.me/products/uzb/
[zwave-js]: https://zwave-js.github.io/node-zwave-js/
[zwave-prometheus-exporter]: https://github.com/ilshidur/zwave-prometheus-exporter/
