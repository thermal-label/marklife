[**marklife**](../../../README.md)

***

[marklife](../../../README.md) / [web/src](../README.md) / OPTIONAL\_SERVICES

# Variable: OPTIONAL\_SERVICES

> `const` **OPTIONAL\_SERVICES**: readonly `string`[]

Every service a marklife chassis might host or advertise. Web
Bluetooth blocks access to any service absent from
`optionalServices`, and the advertised vendor UUID has to be here
too so a service-based filter can fall back to it.
