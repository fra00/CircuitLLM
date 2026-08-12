import type { Circuit } from '../types/circuit'

/**
 * Sample "Robot Controller" circuit used to validate the custom node
 * rendering before the LLM backend is integrated (Phase 3).
 */
export const SAMPLE_CIRCUIT: Circuit = {
  circuit_name: 'Robot Controller',
  components: [
    {
      id: 'U1',
      label: 'Arduino Nano',
      type: 'MICROCONTROLLER',
      kicad_symbol: 'MCU_Module:Arduino_Nano',
      pins: [
        { id: 'D0', label: 'D0/RX', type: 'INPUT' },
        { id: 'D1', label: 'D1/TX', type: 'OUTPUT' },
        { id: 'D2', label: 'D2/INT0', type: 'INPUT' },
        { id: 'D3', label: 'D3/PWM', type: 'OUTPUT' },
        { id: 'D4', label: 'D4', type: 'OUTPUT' },
        { id: 'D5', label: 'D5/PWM', type: 'OUTPUT' },
        { id: 'D6', label: 'D6/PWM', type: 'OUTPUT' },
        { id: 'D7', label: 'D7', type: 'BIDIRECTIONAL' },
        { id: 'D8', label: 'D8', type: 'BIDIRECTIONAL' },
        { id: 'D9', label: 'D9/PWM', type: 'OUTPUT' },
        { id: 'D10', label: 'D10/PWM', type: 'OUTPUT' },
        { id: 'D11', label: 'D11/PWM', type: 'BIDIRECTIONAL' },
        { id: 'D12', label: 'D12', type: 'BIDIRECTIONAL' },
        { id: 'D13', label: 'D13', type: 'OUTPUT' },
        { id: 'A0', label: 'A0', type: 'BIDIRECTIONAL' },
        { id: 'A1', label: 'A1', type: 'BIDIRECTIONAL' },
        { id: 'A2', label: 'A2', type: 'BIDIRECTIONAL' },
        { id: 'A3', label: 'A3', type: 'BIDIRECTIONAL' },
        { id: 'A4', label: 'A4/SDA', type: 'BIDIRECTIONAL' },
        { id: 'A5', label: 'A5/SCL', type: 'BIDIRECTIONAL' },
        { id: 'A6', label: 'A6', type: 'BIDIRECTIONAL' },
        { id: 'A7', label: 'A7', type: 'BIDIRECTIONAL' },
        { id: 'VIN', label: 'VIN', type: 'POWER_IN' },
        { id: '5V', label: '5V', type: 'POWER_OUT' },
        { id: '3V3', label: '3V3', type: 'POWER_OUT' },
        { id: 'GND', label: 'GND', type: 'POWER_IN' },
        { id: 'GND2', label: 'GND', type: 'POWER_IN' },
        { id: 'GND3', label: 'GND', type: 'POWER_IN' },
        { id: 'RST', label: 'RST', type: 'INPUT' },
        { id: 'REF', label: 'REF', type: 'INPUT' },
      ],
    },
    {
      id: 'M1',
      label: 'DC Motor w/ Encoder',
      type: 'MOTOR',
      kicad_symbol: 'Motor:Motor_DC',
      pins: [
        { id: 'PWR1', label: '+', type: 'POWER_IN' },
        { id: 'PWR2', label: '-', type: 'POWER_IN' },
        { id: 'ENC_A', label: 'ENC_A', type: 'OUTPUT' },
        { id: 'ENC_B', label: 'ENC_B', type: 'OUTPUT' },
      ],
    },
    {
      id: 'S1',
      label: 'HC-SR04 Ultrasonic',
      type: 'SENSOR',
      kicad_symbol: 'Sensor:HC-SR04',
      pins: [
        { id: 'VCC', label: 'VCC', type: 'POWER_IN' },
        { id: 'TRIG', label: 'TRIG', type: 'INPUT' },
        { id: 'ECHO', label: 'ECHO', type: 'OUTPUT' },
        { id: 'GND', label: 'GND', type: 'POWER_IN' },
      ],
    },
    {
      id: 'R1',
      label: 'Pull-up',
      type: 'RESISTOR',
      value: '10k',
      kicad_symbol: 'Device:R',
      pins: [
        { id: 'A', label: '1', type: 'PASSIVE' },
        { id: 'B', label: '2', type: 'PASSIVE' },
      ],
    },
  ],
  nets: [
    {
      name: '5V_BUS',
      connections: [
        { component_id: 'U1', pin_id: '5V' },
        { component_id: 'S1', pin_id: 'VCC' },
        { component_id: 'R1', pin_id: 'A' },
      ],
    },
    {
      name: 'GND_BUS',
      connections: [
        { component_id: 'U1', pin_id: 'GND' },
        { component_id: 'S1', pin_id: 'GND' },
        { component_id: 'M1', pin_id: 'PWR2' },
      ],
    },
    {
      name: 'TRIG_SIGNAL',
      connections: [
        { component_id: 'U1', pin_id: 'D3' },
        { component_id: 'S1', pin_id: 'TRIG' },
      ],
    },
    {
      name: 'ECHO_SIGNAL',
      connections: [
        { component_id: 'U1', pin_id: 'D2' },
        { component_id: 'S1', pin_id: 'ECHO' },
      ],
    },
    {
      name: 'MOTOR_PWM',
      connections: [
        { component_id: 'U1', pin_id: 'D4' },
        { component_id: 'M1', pin_id: 'PWR1' },
      ],
    },
    {
      name: 'ENC_A_SIGNAL',
      connections: [
        { component_id: 'M1', pin_id: 'ENC_A' },
        { component_id: 'U1', pin_id: 'D2' },
      ],
    },
  ],
}
