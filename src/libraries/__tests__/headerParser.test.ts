import { describe, expect, it } from "vitest";
import { clean, memberSignature, parseHeaders } from "../headerParser";

const servoLike = `
/* Servo.h - Interrupt driven Servo library
   Copyright (c) 2009 Michael Margolis. */
#ifndef Servo_h
#define Servo_h
#include <inttypes.h>
#define MIN_PULSE_WIDTH 544 // the shortest pulse

typedef struct { uint8_t nbr : 6; } ServoPin_t;

class Servo
{
public:
  Servo();
  uint8_t attach(int pin);           // attach the given pin
  uint8_t attach(int pin, int min, int max);
  void detach();
  void write(int value);
  int read() const { return value; }  // inline
  bool attached();
  static int count();
private:
  int8_t min;
  void _internal();
};
#endif
`;

const tricky = `
namespace sensors {
namespace detail { class Hidden { public: void x(); }; }

class Base : public Print {
public:
  virtual ~Base();
  virtual bool begin(uint8_t addr = 0x40, TwoWire *wire = &Wire) = 0;
  Base(const Base &other) = delete;
  Base &operator=(const Base &);
protected:
  void notListed();
};

struct Reading { float value; int unit; float scaled(float k) const; };

class Sensor final : public Base, private Helper {
  int hidden();
public:
  explicit Sensor(uint8_t pin) : _pin(pin), _ok(false) {}
  Sensor(const Sensor&);
  bool begin(uint8_t addr = 0x40, TwoWire *wire = &Wire) override;
  void onEvent(void (*callback)(int));
  void (*handler)(int);
  float read(const char* label = "a;b{c}");
  #if defined(ESP32)
  void sleep(uint32_t ms);
  #else
  void sleep(uint32_t ms);
  #endif
  friend class Other;
  enum Mode { A, B };
  class Inner { public: void innerOnly(); };
  template <typename T> void tmpl(T x);
};

template <typename T> class Container { public: void add(T x); };
}
`;

describe("header parser", () => {
    it("removes comments and preprocessor lines but keeps strings", () => {
        const c = clean('int a; // x\n#define Y 1\nconst char* s = "// not a comment";\n/* b */');
        expect(c).not.toContain("#define");
        expect(c).toContain('"// not a comment"');
        expect(c).not.toContain("/* b */");
    });

    it("extracts a Servo-like class", () => {
        const [servo] = parseHeaders([{ path: "Servo.h", text: servoLike }]);
        expect(servo.name).toBe("Servo");
        expect(servo.constructors).toEqual(["Servo()"]);
        expect(servo.methods).toEqual([
            "uint8_t attach(int pin)",
            "uint8_t attach(int pin, int min, int max)",
            "void detach()",
            "void write(int value)",
            "int read()",
            "bool attached()",
            "static int count()",
        ]);
    });

    it("applies the access, skip and inheritance rules", () => {
        const classes = parseHeaders([{ path: "Sensor.h", text: tricky }]);
        const names = classes.map((c) => c.name);
        expect(names).not.toContain("Hidden"); // private namespace
        expect(names).not.toContain("Container"); // template
        const reading = classes.find((c) => c.name === "Reading")!;
        expect(reading.methods).toEqual(["float scaled(float k)"]); // struct: public by default
        const sensor = classes.find((c) => c.name === "Sensor")!;
        expect(sensor.bases).toEqual(["Base"]);
        expect(sensor.constructors).toEqual(["Sensor(uint8_t pin)"]);
        expect(sensor.methods.slice(0, 4)).toEqual([
            "bool begin(uint8_t addr = 0x40, TwoWire *wire = &Wire)",
            "void onEvent(void(*callback)(int))",
            'float read(const char *label = "a;b{c}")',
            "void sleep(uint32_t ms)",
        ]);
        // inherited from Base, then from Arduino's Print
        expect(sensor.methods).toContain("size_t println(int n, int base = DEC)");
        expect(sensor.methods).not.toContain("void notListed()");
        expect(sensor.methods.filter((m) => m.startsWith("bool begin"))).toHaveLength(1);
        expect(classes.find((c) => c.name === "Inner")!.nested).toBe(true);
    });

    it("is deterministic", () => {
        const files = [{ path: "Sensor.h", text: tricky }, { path: "Servo.h", text: servoLike }];
        expect(parseHeaders(files)).toEqual(parseHeaders(JSON.parse(JSON.stringify(files))));
    });

    it("skips non-method members", () => {
        expect(memberSignature("int value", "X")).toBeNull();
        expect(memberSignature("void (*cb)(int)", "X")).toBeNull();
        expect(memberSignature("DEPRECATED(foo)", "X")).toBeNull();
        expect(memberSignature("static FASTLED_FORCE_INLINE uint8_t adjust(uint8_t d)", "X")).toBe(
            "static uint8_t adjust(uint8_t d)",
        );
    });
});
