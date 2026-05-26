const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const cloneValue = (value) => {
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, entry]));
  }
  return value;
};

const createZeroVelocity = (value) => {
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).map((key) => [key, 0]));
  }
  return 0;
};

const scalarSpring = (current, target, velocity, dt, stiffness, damping) => {
  // Per-frame integration: velocity += force; velocity *= damping; position += velocity
  // This avoids dt*dt tiny-step issues and produces visible motion quickly.
  const force = (target - current) * stiffness;
  let nextVelocity = velocity + force;
  nextVelocity *= damping;
  const nextValue = current + nextVelocity;
  return { value: nextValue, velocity: nextVelocity };
};

const updateValues = (current, target, velocity, dt, stiffness, damping) => {
  if (isPlainObject(current) && isPlainObject(target) && isPlainObject(velocity)) {
    const nextCurrent = {};
    const nextVelocity = {};
    for (const key of Object.keys(current)) {
      const next = scalarSpring(current[key], target[key], velocity[key], dt, stiffness, damping);
      nextCurrent[key] = next.value;
      nextVelocity[key] = next.velocity;
    }
    return { current: nextCurrent, velocity: nextVelocity };
  }
  const next = scalarSpring(current, target, velocity, dt, stiffness, damping);
  return { current: next.value, velocity: next.velocity };
};

const isAtRest = (current, target, velocity, precision) => {
  if (isPlainObject(current) && isPlainObject(target) && isPlainObject(velocity)) {
    return Object.keys(current).every((key) => {
      return Math.abs(current[key] - target[key]) <= precision && Math.abs(velocity[key]) <= precision;
    });
  }
  return Math.abs(current - target) <= precision && Math.abs(velocity) <= precision;
};

export class SpringValue {
  constructor(initial, options = {}) {
    this.current = cloneValue(initial);
    this.target = cloneValue(initial);
    this.velocity = createZeroVelocity(initial);
    this.stiffness = options.stiffness ?? 0.2;
    this.damping = options.damping ?? 0.8;
    this.precision = options.precision ?? 0.001;
  }

  setTarget(target) {
    this.target = cloneValue(target);
  }

  update(dt) {
    if (dt <= 0) return;
    const result = updateValues(this.current, this.target, this.velocity, dt, this.stiffness, this.damping);
    this.current = result.current;
    this.velocity = result.velocity;
    if (isAtRest(this.current, this.target, this.velocity, this.precision)) {
      this.current = cloneValue(this.target);
      this.velocity = createZeroVelocity(this.current);
    }
  }

  isAtRest() {
    return isAtRest(this.current, this.target, this.velocity, this.precision);
  }
}
