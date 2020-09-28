import { RenderingTestCase, moduleFor, runTask } from 'internal-test-helpers';
import { invokeHelper, Helper, Component as EmberComponent } from '@ember/-internals/glimmer';
import { tracked, set } from '@ember/-internals/metal';
import { getOwner } from '@ember/-internals/owner';
import { EMBER_GLIMMER_INVOKE_HELPER } from '@ember/canary-features';
import Service, { inject as service } from '@ember/service';
import { getValue } from '@glimmer/validator';
import { destroy, isDestroyed } from '@glimmer/runtime';

if (EMBER_GLIMMER_INVOKE_HELPER) {
  moduleFor(
    'Helpers test: invokeHelper',
    class extends RenderingTestCase {
      ['@test it works with a component']() {
        class PlusOneHelper extends Helper {
          compute([num]) {
            return num + 1;
          }
        }

        class PlusOne extends EmberComponent {
          @tracked number;

          plusOne = invokeHelper(this, PlusOneHelper, () => {
            return {
              positional: [this.number],
            };
          });

          get value() {
            return getValue(this.plusOne);
          }
        }

        this.registerComponent('plus-one', {
          template: `{{this.value}}`,
          ComponentClass: PlusOne,
        });

        this.render(`<PlusOne @number={{this.value}} />`, {
          value: 4,
        });

        this.assertText('5');

        runTask(() => this.rerender());

        this.assertText('5');

        runTask(() => set(this.context, 'value', 5));

        this.assertText('6');
      }

      ['@test services can be injected if there is an owner']() {
        let numberService;

        this.registerService(
          'number',
          class extends Service {
            constructor() {
              super(...arguments);
              numberService = this;
            }

            @tracked value = 4;
          }
        );

        class PlusOneHelper extends Helper {
          @service number;

          compute() {
            return this.number.value + 1;
          }
        }

        class PlusOne extends EmberComponent {
          plusOne = invokeHelper(this, PlusOneHelper, () => {
            return {
              positional: [this.number],
            };
          });

          get value() {
            return getValue(this.plusOne);
          }
        }

        this.registerComponent('plus-one', {
          template: `{{this.value}}`,
          ComponentClass: PlusOne,
        });

        this.render(`<PlusOne />`);

        this.assertText('5');

        runTask(() => this.rerender());

        this.assertText('5');

        runTask(() => (numberService.value = 5));

        this.assertText('6');
      }

      ['@test works if there is no owner'](assert) {
        class PlusOneHelper extends Helper {
          compute([num]) {
            return num + 1;
          }
        }

        class PlusOne {
          constructor(number) {
            this.number = number;
          }

          plusOne = invokeHelper(this, PlusOneHelper, () => {
            return { positional: [this.number] };
          });

          get value() {
            return getValue(this.plusOne);
          }
        }

        let instance = new PlusOne(4);

        assert.notOk(getOwner(instance), 'no owner exists on the wrapper');
        assert.equal(instance.value, 5, 'helper works without an owner');
      }

      ['@test tracking for arguments works for tracked properties'](assert) {
        let count = 0;

        class PlusOneHelper extends Helper {
          compute([num]) {
            count++;
            return num + 1;
          }
        }

        class PlusOne {
          @tracked number;

          constructor(number) {
            this.number = number;
          }

          plusOne = invokeHelper(this, PlusOneHelper, () => {
            return { positional: [this.number] };
          });

          get value() {
            return getValue(this.plusOne);
          }
        }

        let instance = new PlusOne(4);

        assert.equal(instance.value, 5, 'helper works');
        assert.equal(instance.value, 5, 'helper works');
        assert.equal(count, 1, 'helper only called once');

        instance.number = 5;

        assert.equal(instance.value, 6, 'helper works');
        assert.equal(count, 2, 'helper called a second time');
      }

      ['@test helper updates based on internal state changes'](assert) {
        let count = 0;
        let helper;

        class PlusOneHelper extends Helper {
          @tracked number = 4;

          constructor() {
            super(...arguments);
            helper = this;
          }

          compute() {
            count++;
            return this.number + 1;
          }
        }

        class PlusOne {
          plusOne = invokeHelper(this, PlusOneHelper);

          get value() {
            return getValue(this.plusOne);
          }
        }

        let instance = new PlusOne();

        assert.equal(instance.value, 5, 'helper works');
        assert.equal(instance.value, 5, 'helper works');
        assert.equal(count, 1, 'helper only called once');

        helper.number = 5;

        assert.equal(instance.value, 6, 'helper works');
        assert.equal(count, 2, 'helper called a second time');
      }

      ['@test helper destroys correctly when context object is destroyed'](assert) {
        assert.expect(3);

        let context = {};

        class TestHelper extends Helper {
          willDestroy() {
            assert.ok(true, 'helper destroyed');
          }
        }

        let helper = invokeHelper(context, TestHelper);

        runTask(() => destroy(context));

        assert.ok(isDestroyed(context), 'context destroyed');
        assert.ok(isDestroyed(helper), 'helper cache destroyed');
      }

      ['@test helper destroys correctly when helper cache is destroyed'](assert) {
        assert.expect(3);

        let context = {};

        class TestHelper extends Helper {
          willDestroy() {
            assert.ok(true, 'helper destroyed');
          }
        }

        let helper = invokeHelper(context, TestHelper);

        runTask(() => destroy(helper));

        assert.notOk(isDestroyed(context), 'context NOT destroyed');
        assert.ok(isDestroyed(helper), 'helper cache destroyed');
      }

      ['@test throws an error if value is accessed after it is destroyed']() {
        expectAssertion(() => {
          let helper = invokeHelper({}, class extends Helper {});

          runTask(() => destroy(helper));

          getValue(helper);
        }, /You attempted to get the value of a helper after the helper was destroyed, which is not allowed/);
      }

      ['@test asserts if no context object is passed']() {
        expectAssertion(() => {
          invokeHelper(undefined, class extends Helper {});
        }, /Expected a context object to be passed as the first parameter to invokeHelper, got undefined/);
      }

      ['@test asserts if no manager exists for the helper definition']() {
        expectAssertion(() => {
          invokeHelper({}, class {});
        }, /Expected a helper definition to be passed as the second parameter to invokeHelper, but no helper manager was found. Did you use setHelperManager to associate a helper manager?/);
      }
    }
  );
}
