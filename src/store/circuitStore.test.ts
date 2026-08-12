import { beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_CIRCUIT } from '../data/sampleCircuit'
import { useCircuitStore } from './circuitStore'

function resetStore() {
  useCircuitStore.setState({
    circuit: structuredClone(SAMPLE_CIRCUIT),
    notifications: [],
  })
}

describe('circuitStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('addComponent ignores duplicate ids', () => {
    const before = useCircuitStore.getState().circuit.components.length
    useCircuitStore.getState().addComponent(SAMPLE_CIRCUIT.components[0])
    expect(useCircuitStore.getState().circuit.components.length).toBe(before)
  })

  it('addComponent appends a new component and notifies', () => {
    useCircuitStore.getState().addComponent({
      id: 'C99',
      label: 'Bypass',
      type: 'CAPACITOR',
      value: '100n',
      pins: [
        { id: 'A', label: '1', type: 'PASSIVE' },
        { id: 'B', label: '2', type: 'PASSIVE' },
      ],
    })
    expect(useCircuitStore.getState().circuit.components.some((c) => c.id === 'C99')).toBe(true)
    expect(useCircuitStore.getState().notifications.length).toBeGreaterThan(0)
  })

  it('updateComponentIdentity remaps net connections when id changes', () => {
    useCircuitStore.getState().updateComponentIdentity('R1', 'R9', 'New pull-up')
    const circuit = useCircuitStore.getState().circuit
    expect(circuit.components.some((c) => c.id === 'R9')).toBe(true)
    expect(circuit.components.some((c) => c.id === 'R1')).toBe(false)
    const net = circuit.nets.find((n) => n.name === '5V_BUS')
    expect(net?.connections.some((c) => c.component_id === 'R9')).toBe(true)
  })

  it('updateComponentIdentity rejects duplicate target id', () => {
    useCircuitStore.getState().updateComponentIdentity('R1', 'U1', 'Collision')
    expect(useCircuitStore.getState().circuit.components.some((c) => c.id === 'R1')).toBe(true)
  })

  it('updateComponentIdentity can rename label only', () => {
    useCircuitStore.getState().updateComponentIdentity('R1', 'R1', 'Pull-up 5V')
    const r1 = useCircuitStore.getState().circuit.components.find((c) => c.id === 'R1')
    expect(r1?.label).toBe('Pull-up 5V')
  })

  it('removeComponent drops dangling nets', () => {
    useCircuitStore.getState().removeComponent('S1')
    const circuit = useCircuitStore.getState().circuit
    expect(circuit.components.some((c) => c.id === 'S1')).toBe(false)
    expect(circuit.nets.every((n) => !n.connections.some((c) => c.component_id === 'S1'))).toBe(
      true,
    )
  })

  it('addPin creates unique ids and supports pin type', () => {
    useCircuitStore.getState().addPin('U1', 'EXTRA', 'INPUT')
    useCircuitStore.getState().addPin('U1', 'EXTRA', 'OUTPUT')
    const u1 = useCircuitStore.getState().circuit.components.find((c) => c.id === 'U1')
    expect(u1?.pins.some((p) => p.id === 'EXTRA' && p.type === 'INPUT')).toBe(true)
    expect(u1?.pins.some((p) => p.id === 'EXTRA_2' && p.type === 'OUTPUT')).toBe(true)
  })

  it('removePin strips nets and refuses last pin', () => {
    useCircuitStore.getState().removePin('R1', 'A')
    const afterRemove = useCircuitStore.getState().circuit.components.find((c) => c.id === 'R1')
    expect(afterRemove?.pins.some((p) => p.id === 'A')).toBe(false)
    expect(
      useCircuitStore
        .getState()
        .circuit.nets.every(
          (n) => !n.connections.some((c) => c.component_id === 'R1' && c.pin_id === 'A'),
        ),
    ).toBe(true)

    while (
      (useCircuitStore.getState().circuit.components.find((c) => c.id === 'R1')?.pins.length ?? 0) >
      1
    ) {
      const pinId = useCircuitStore
        .getState()
        .circuit.components.find((c) => c.id === 'R1')!.pins[0].id
      useCircuitStore.getState().removePin('R1', pinId)
    }
    const lastPin = useCircuitStore
      .getState()
      .circuit.components.find((c) => c.id === 'R1')!.pins[0].id
    useCircuitStore.getState().removePin('R1', lastPin)
    expect(
      useCircuitStore.getState().circuit.components.find((c) => c.id === 'R1')!.pins,
    ).toHaveLength(1)
  })

  it('addConnectionNet creates a named net once', () => {
    useCircuitStore.getState().addConnectionNet(
      'TEST_NET',
      { component_id: 'U1', pin_id: 'D13' },
      { component_id: 'R1', pin_id: 'B' },
    )
    expect(useCircuitStore.getState().circuit.nets.some((n) => n.name === 'TEST_NET')).toBe(true)
    const before = useCircuitStore.getState().circuit.nets.length
    useCircuitStore.getState().addConnectionNet(
      'TEST_NET',
      { component_id: 'U1', pin_id: 'D12' },
      { component_id: 'R1', pin_id: 'A' },
    )
    expect(useCircuitStore.getState().circuit.nets.length).toBe(before)
  })

  it('removeConnection drops net when fewer than 2 pins remain', () => {
    useCircuitStore.getState().addConnectionNet(
      'TEMP',
      { component_id: 'U1', pin_id: 'D13' },
      { component_id: 'R1', pin_id: 'B' },
    )
    useCircuitStore.getState().removeConnection('TEMP', {
      component_id: 'U1',
      pin_id: 'D13',
    })
    expect(useCircuitStore.getState().circuit.nets.some((n) => n.name === 'TEMP')).toBe(false)
  })

  it('connectPins merges two different nets', () => {
    useCircuitStore.getState().connectPins(
      { component_id: 'U1', pin_id: 'D4' },
      { component_id: 'S1', pin_id: 'ECHO' },
    )
    const circuit = useCircuitStore.getState().circuit
    const motorNet = circuit.nets.find((n) =>
      n.connections.some((c) => c.component_id === 'U1' && c.pin_id === 'D4'),
    )
    const echoNet = circuit.nets.find((n) =>
      n.connections.some((c) => c.component_id === 'S1' && c.pin_id === 'ECHO'),
    )
    expect(motorNet?.name).toBe(echoNet?.name)
    expect(circuit.nets.some((n) => n.name === 'MOTOR_PWM')).toBe(false)
  })

  it('connectPins appends a free pin onto an existing net', () => {
    const before = useCircuitStore.getState().circuit.nets.find((n) => n.name === '5V_BUS')!
    useCircuitStore.getState().connectPins(
      { component_id: 'U1', pin_id: '5V' },
      { component_id: 'U1', pin_id: 'D13' },
    )
    const after = useCircuitStore.getState().circuit.nets.find((n) => n.name === '5V_BUS')!
    expect(after.connections.length).toBe(before.connections.length + 1)
    expect(after.connections.some((c) => c.pin_id === 'D13')).toBe(true)
  })

  it('connectPins creates a new net when both pins are free', () => {
    const before = useCircuitStore.getState().circuit.nets.length
    useCircuitStore.getState().connectPins(
      { component_id: 'U1', pin_id: 'D12' },
      { component_id: 'U1', pin_id: 'D13' },
    )
    expect(useCircuitStore.getState().circuit.nets.length).toBe(before + 1)
  })

  it('connectPins is a no-op when pins already share a net', () => {
    const before = JSON.stringify(useCircuitStore.getState().circuit.nets)
    useCircuitStore.getState().connectPins(
      { component_id: 'U1', pin_id: '5V' },
      { component_id: 'R1', pin_id: 'A' },
    )
    expect(JSON.stringify(useCircuitStore.getState().circuit.nets)).toBe(before)
  })

  it('disconnectEdge removes both ends and may drop the net', () => {
    useCircuitStore.getState().addConnectionNet(
      'WIRE',
      { component_id: 'U1', pin_id: 'D12' },
      { component_id: 'U1', pin_id: 'D13' },
    )
    useCircuitStore.getState().disconnectEdge(
      'WIRE',
      { component_id: 'U1', pin_id: 'D12' },
      { component_id: 'U1', pin_id: 'D13' },
    )
    expect(useCircuitStore.getState().circuit.nets.some((n) => n.name === 'WIRE')).toBe(false)
  })

  it('reconnectConnection moves a pin endpoint', () => {
    useCircuitStore.getState().reconnectConnection(
      '5V_BUS',
      { component_id: 'R1', pin_id: 'A' },
      { component_id: 'U1', pin_id: 'D13' },
    )
    const net = useCircuitStore.getState().circuit.nets.find((n) => n.name === '5V_BUS')
    expect(net?.connections.some((c) => c.component_id === 'R1' && c.pin_id === 'A')).toBe(false)
    expect(net?.connections.some((c) => c.component_id === 'U1' && c.pin_id === 'D13')).toBe(true)
  })

  it('records notification on meaningful mutations', () => {
    useCircuitStore.getState().updateComponentValue('R1', '4.7k')
    expect(useCircuitStore.getState().notifications.length).toBeGreaterThan(0)
  })

  it('clearNotifications empties the queue', () => {
    useCircuitStore.getState().updateComponentValue('R1', '4.7k')
    useCircuitStore.getState().clearNotifications()
    expect(useCircuitStore.getState().notifications).toHaveLength(0)
  })

  it('loadCircuit resets notifications', () => {
    useCircuitStore.getState().updateComponentValue('R1', '4.7k')
    useCircuitStore.getState().loadCircuit(structuredClone(SAMPLE_CIRCUIT))
    expect(useCircuitStore.getState().notifications).toHaveLength(0)
  })
})
