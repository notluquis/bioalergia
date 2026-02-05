# Biome Linter Rules (Latest Docs)

Generated: 2026-02-04
Sources:
- JavaScript: https://next.biomejs.dev/linter/javascript/rules
- JSON: https://next.biomejs.dev/linter/json/rules
- CSS: https://next.biomejs.dev/linter/css/rules
- GraphQL: https://next.biomejs.dev/linter/graphql/rules

## JavaScript

### a11y

- `noAccessKey` — Enforce that the accessKey attribute is not used on any HTML element.
- `noAriaHiddenOnFocusable` — Enforce that aria-hidden=“true” is not set on focusable elements.
- `noAriaUnsupportedElements` — Enforce that elements that do not support ARIA roles, states, and properties do not have those attributes.
- `noAutofocus` — Enforce that autoFocus prop is not used on elements.
- `noDistractingElements` — Enforces that no distracting elements are used.
- `noHeaderScope` — The scope prop should be used only on <th> elements.
- `noInteractiveElementToNoninteractiveRole` — Enforce that non-interactive ARIA roles are not assigned to interactive HTML elements.
- `noLabelWithoutControl` — Enforce that a label element or component has a text label and an associated input.
- `noNoninteractiveElementInteractions` — Disallow use event handlers on non-interactive elements.
- `noNoninteractiveElementToInteractiveRole` — Enforce that interactive ARIA roles are not assigned to non-interactive HTML elements.
- `noNoninteractiveTabindex` — Enforce that tabIndex is not assigned to non-interactive HTML elements.
- `noPositiveTabindex` — Prevent the usage of positive integers on tabIndex property
- `noRedundantAlt` — Enforce img alt prop does not contain the word “image”, “picture”, or “photo”.
- `noRedundantRoles` — Enforce explicit role property is not the same as implicit/default role property on an element.
- `noStaticElementInteractions` — Enforce that static, visible elements (such as <div> ) that have click handlers use the valid role attribute.
- `noSvgWithoutTitle` — Enforces the usage of the title element for the svg element.
- `useAltText` — Enforce that all elements that require alternative text have meaningful information to relay back to the end user.
- `useAnchorContent` — Enforce that anchors have content and that the content is accessible to screen readers.
- `useAriaActivedescendantWithTabindex` — Enforce that tabIndex is assigned to non-interactive HTML elements with aria-activedescendant .
- `useAriaPropsForRole` — Enforce that elements with ARIA roles must have all required ARIA attributes for that role.
- `useAriaPropsSupportedByRole` — Enforce that ARIA properties are valid for the roles that are supported by the element.
- `useButtonType` — Enforces the usage of the attribute type for the element button
- `useFocusableInteractive` — Elements with an interactive role and interaction handlers must be focusable.
- `useHeadingContent` — Enforce that heading elements (h1, h2, etc.) have content and that the content is accessible to screen readers. Accessible means that it is not hidden using the aria-hidden prop.
- `useHtmlLang` — Enforce that html element has lang attribute.
- `useIframeTitle` — Enforces the usage of the attribute title for the element iframe .
- `useKeyWithClickEvents` — Enforce onClick is accompanied by at least one of the following: onKeyUp , onKeyDown , onKeyPress .
- `useKeyWithMouseEvents` — Enforce onMouseOver / onMouseOut are accompanied by onFocus / onBlur .
- `useMediaCaption` — Enforces that audio and video elements must have a track for captions.
- `useSemanticElements` — It detects the use of role attributes in JSX elements and suggests using semantic elements instead.
- `useValidAnchor` — Enforce that all anchors are valid, and they are navigable elements.
- `useValidAriaProps` — Ensures that ARIA properties aria-* are all valid.
- `useValidAriaRole` — Elements with ARIA roles must use a valid, non-abstract ARIA role.
- `useValidAriaValues` — Enforce that ARIA state and property values are valid.
- `useValidAutocomplete` — Use valid values for the autocomplete attribute on input elements.
- `useValidLang` — Ensure that the attribute passed to the lang attribute is a correct ISO language and/or country.

### complexity

- `noAdjacentSpacesInRegex` — Disallow unclear usage of consecutive space characters in regular expression literals
- `noArguments` — Disallow the use of arguments .
- `noBannedTypes` — Disallow primitive type aliases and misleading types.
- `noCommaOperator` — Disallow comma operator.
- `noEmptyTypeParameters` — Disallow empty type parameters in type aliases and interfaces.
- `noExcessiveCognitiveComplexity` — Disallow functions that exceed a given Cognitive Complexity score.
- `noExcessiveLinesPerFunction` — Restrict the number of lines of code in a function.
- `noExcessiveNestedTestSuites` — This rule enforces a maximum depth to nested describe() in test files.
- `noExtraBooleanCast` — Disallow unnecessary boolean casts
- `noFlatMapIdentity` — Disallow to use unnecessary callback on flatMap .
- `noForEach` — Prefer for...of statement instead of Array.forEach .
- `noImplicitCoercions` — Disallow shorthand type conversions.
- `noStaticOnlyClass` — This rule reports when a class has no non-static members, such as for a class used exclusively as a static namespace.
- `noThisInStatic` — Disallow this and super in static contexts.
- `noUselessCatch` — Disallow unnecessary catch clauses.
- `noUselessConstructor` — Disallow unnecessary constructors.
- `noUselessContinue` — Avoid using unnecessary continue .
- `noUselessEmptyExport` — Disallow empty exports that don’t change anything in a module file.
- `noUselessEscapeInRegex` — Disallow unnecessary escape sequence in regular expression literals.
- `noUselessFragments` — Disallow unnecessary fragments
- `noUselessLabel` — Disallow unnecessary labels.
- `noUselessLoneBlockStatements` — Disallow unnecessary nested block statements.
- `noUselessRename` — Disallow renaming import, export, and destructured assignments to the same name.
- `noUselessStringConcat` — Disallow unnecessary concatenation of string or template literals.
- `noUselessStringRaw` — Disallow unnecessary String.raw function in template string literals without any escape sequence.
- `noUselessSwitchCase` — Disallow useless case in switch statements.
- `noUselessTernary` — Disallow ternary operators when simpler alternatives exist.
- `noUselessThisAlias` — Disallow useless this aliasing.
- `noUselessTypeConstraint` — Disallow using any or unknown as type constraint.
- `noUselessUndefinedInitialization` — Disallow initializing variables to undefined .
- `noVoid` — Disallow the use of void operators, which is not a familiar operator.
- `useArrowFunction` — Use arrow functions over function expressions.
- `useDateNow` — Use Date.now() to get the number of milliseconds since the Unix Epoch.
- `useFlatMap` — Promotes the use of .flatMap() when map().flat() are used together.
- `useIndexOf` — Prefer Array#{indexOf,lastIndexOf}() over Array#{findIndex,findLastIndex}() when looking for the index of an item.
- `useLiteralKeys` — Enforce the usage of a literal access to properties over computed property access.
- `useNumericLiterals` — Disallow parseInt() and Number.parseInt() in favor of binary, octal, and hexadecimal literals
- `useOptionalChain` — Enforce using concise optional chain instead of chained logical expressions.
- `useRegexLiterals` — Enforce the use of the regular expression literals instead of the RegExp constructor if possible.
- `useSimpleNumberKeys` — Disallow number literal object member names which are not base 10 or use underscore as separator.
- `useSimplifiedLogicExpression` — Discard redundant terms from logical expressions.
- `useWhile` — Enforce the use of while loops instead of for loops when the initializer and update expressions are not needed.

### correctness

- `noChildrenProp` — Prevent passing of children as props.
- `noConstAssign` — Prevents from having const variables being re-assigned.
- `noConstantCondition` — Disallow constant expressions in conditions
- `noConstantMathMinMaxClamp` — Disallow the use of Math.min and Math.max to clamp a value where the result itself is constant.
- `noConstructorReturn` — Disallow returning a value from a constructor .
- `noEmptyCharacterClassInRegex` — Disallow empty character classes in regular expression literals.
- `noEmptyPattern` — Disallows empty destructuring patterns.
- `noGlobalDirnameFilename` — Disallow the use of __dirname and __filename in the global scope.
- `noGlobalObjectCalls` — Disallow calling global object properties as functions
- `noInnerDeclarations` — Disallow function and var declarations that are accessible outside their block.
- `noInvalidBuiltinInstantiation` — Ensure that builtins are correctly instantiated.
- `noInvalidConstructorSuper` — Prevents the incorrect use of super() inside classes. It also checks whether a call super() is missing from classes that extends other constructors.
- `noInvalidUseBeforeDeclaration` — Disallow the use of variables, function parameters, classes, and enums before their declaration
- `noNestedComponentDefinitions` — Disallows defining React components inside other components.
- `noNodejsModules` — Forbid the use of Node.js builtin modules.
- `noNonoctalDecimalEscape` — Disallow \8 and \9 escape sequences in string literals.
- `noPrecisionLoss` — Disallow literal numbers that lose precision
- `noPrivateImports` — Restrict imports of private exports.
- `noProcessGlobal` — Disallow the use of process global.
- `noQwikUseVisibleTask` — Disallow useVisibleTask$() functions in Qwik components.
- `noReactPropAssignments` — Disallow assigning to React component props.
- `noRenderReturnValue` — Prevent the usage of the return value of React.render .
- `noRestrictedElements` — Disallow the use of configured elements.
- `noSelfAssign` — Disallow assignments where both sides are exactly the same.
- `noSetterReturn` — Disallow returning a value from a setter
- `noSolidDestructuredProps` — Disallow destructuring props inside JSX components in Solid projects.
- `noStringCaseMismatch` — Disallow comparison of expressions modifying the string case with non-compliant value.
- `noSwitchDeclarations` — Disallow lexical declarations in switch clauses.
- `noUndeclaredDependencies` — Disallow the use of dependencies that aren’t specified in the package.json .
- `noUndeclaredVariables` — Prevents the usage of variables that haven’t been declared inside the document.
- `noUnreachable` — Disallow unreachable code
- `noUnreachableSuper` — Ensures the super() constructor is called exactly once on every code  path in a class constructor before this is accessed if the class has a superclass
- `noUnsafeFinally` — Disallow control flow statements in finally blocks.
- `noUnsafeOptionalChaining` — Disallow the use of optional chaining in contexts where the undefined value is not allowed.
- `noUnusedFunctionParameters` — Disallow unused function parameters.
- `noUnusedImports` — Disallow unused imports.
- `noUnusedLabels` — Disallow unused labels.
- `noUnusedPrivateClassMembers` — Disallow unused private class members
- `noUnusedVariables` — Disallow unused variables.
- `noVoidElementsWithChildren` — This rules prevents void elements (AKA self-closing elements) from having children.
- `noVoidTypeReturn` — Disallow returning a value from a function with the return type ‘void’
- `useExhaustiveDependencies` — Enforce correct dependency usage within React hooks.
- `useHookAtTopLevel` — Enforce that all React hooks are being called from the Top Level component functions.
- `useImageSize` — Enforces that <img> elements have both width and height attributes.
- `useImportExtensions` — Enforce file extensions for relative imports.
- `useIsNan` — Require calls to isNaN() when checking for NaN .
- `useJsonImportAttributes` — Enforces the use of with { type: "json" } for JSON module imports.
- `useJsxKeyInIterable` — Disallow missing key props in iterators/collection literals.
- `useParseIntRadix` — Enforce the consistent use of the radix argument when using parseInt() .
- `useQwikClasslist` — Prefer using the class prop as a classlist over the classnames helper.
- `useSingleJsDocAsterisk` — Enforce JSDoc comment lines to start with a single asterisk, except for the first one.
- `useUniqueElementIds` — Prevent the usage of static string literal id attribute on elements.
- `useValidForDirection` — Enforce “for” loop update clause moving the counter in the right direction.
- `useValidTypeof` — This rule checks that the result of a typeof expression is compared to a valid value.
- `useYield` — Require generator functions to contain yield .

### nursery

- `noAmbiguousAnchorText` — Disallow ambiguous anchor descriptions.
- `noBeforeInteractiveScriptOutsideDocument` — Prevent usage of next/script ’s beforeInteractive strategy outside of pages/_document.js in a Next.js project.
- `noContinue` — Disallow continue statements.
- `noDeprecatedImports` — Restrict imports of deprecated exports.
- `noDivRegex` — Disallow equal signs explicitly at the beginning of regular expressions.
- `noDuplicateEnumValues` — Disallow duplicate enum member values.
- `noDuplicatedSpreadProps` — Disallow JSX prop spreading the same identifier multiple times.
- `noEmptySource` — Disallow empty sources.
- `noEqualsToNull` — Require the use of === or !== for comparison with null .
- `noExcessiveClassesPerFile` — Enforce a maximum number of classes per file.
- `noExcessiveLinesPerFile` — Restrict the number of lines in a file.
- `noFloatingClasses` — Disallow new operators outside of assignments or comparisons.
- `noFloatingPromises` — Require Promise-like statements to be handled appropriately.
- `noForIn` — Disallow iterating using a for-in loop.
- `noImportCycles` — Prevent import cycles.
- `noIncrementDecrement` — Disallows the usage of the unary operators ++ and —.
- `noJsxLiterals` — Disallow string literals inside JSX elements.
- `noJsxPropsBind` — Disallow .bind(), arrow functions, or function expressions in JSX props
- `noLeakedRender` — Prevent problematic leaked values from being rendered.
- `noMisusedPromises` — Disallow Promises to be used in places where they are almost certainly a
- `noMultiAssign` — Disallow use of chained assignment expressions
- `noMultiStr` — Disallow creating multiline strings by escaping newlines.
- `noNextAsyncClientComponent` — Prevent client components from being async functions.
- `noParametersOnlyUsedInRecursion` — Disallow function parameters that are only used in recursive calls.
- `noProto` — Disallow the use of the deprecated __proto__ object property.
- `noReactForwardRef` — Replaces usages of forwardRef with passing ref as a prop.
- `noReturnAssign` — Disallow assignments in return statements.
- `noScriptUrl` — Disallow javascript: URLs.
- `noShadow` — Disallow variable declarations from shadowing variables declared in the outer scope.
- `noSyncScripts` — Prevent the usage of synchronous scripts.
- `noTernary` — Disallow ternary operators.
- `noUndeclaredEnvVars` — Disallow the use of undeclared environment variables.
- `noUnknownAttribute` — Disallow unknown DOM properties.
- `noUnnecessaryConditions` — Disallow unnecessary type-based conditions that can be statically determined as redundant.
- `noUnresolvedImports` — Warn when importing non-existing exports.
- `noUnusedExpressions` — Disallow expression statements that are neither a function call nor an
- `noUselessCatchBinding` — Disallow unused catch bindings.
- `noUselessUndefined` — Disallow the use of useless undefined .
- `noVueDataObjectDeclaration` — Enforce that Vue component data options are declared as functions.
- `noVueDuplicateKeys` — Disallow duplicate keys in Vue component data, methods, computed properties, and other options.
- `noVueOptionsApi` — Disallow the use of Vue Options API.
- `noVueReservedKeys` — Disallow reserved keys in Vue component data and computed properties.
- `noVueReservedProps` — Disallow reserved names to be used as props.
- `noVueSetupPropsReactivityLoss` — Disallow destructuring of props passed to setup in Vue projects.
- `useArraySortCompare` — Require Array#sort and Array#toSorted calls to always provide a compareFunction.
- `useAwaitThenable` — Enforce that await is only used on Promise values.
- `useConsistentArrowReturn` — Enforce consistent arrow function bodies.
- `useConsistentEnumValueType` — Disallow enums from having both number and string members.
- `useDestructuring` — Require destructuring from arrays and/or objects
- `useErrorCause` — Enforce that new Error() is thrown with the original error as cause .
- `useExhaustiveSwitchCases` — Require switch-case statements to be exhaustive.
- `useExplicitType` — Enforce types in functions, methods, variables, and parameters.
- `useFind` — Enforce the use of Array.prototype.find() over Array.prototype.filter() followed by [0] when looking for a single result.
- `useInlineScriptId` — Enforce id attribute on next/script components with inline content or dangerouslySetInnerHTML .
- `useMaxParams` — Enforce a maximum number of parameters in function definitions.
- `useQwikMethodUsage` — Disallow use* hooks outside of component$ or other use* hooks in Qwik applications.
- `useQwikValidLexicalScope` — Disallow unserializable expressions in Qwik dollar ($) scopes.
- `useRegexpExec` — Enforce RegExp#exec over String#match if no global flag is provided.
- `useSortedClasses` — Enforce the sorting of CSS utility classes.
- `useSpread` — Enforce the use of the spread operator over .apply() .
- `useVueConsistentDefinePropsDeclaration` — Enforce consistent defineProps declaration style.
- `useVueDefineMacrosOrder` — Enforce specific order of Vue compiler macros.
- `useVueMultiWordComponentNames` — Enforce multi-word component names in Vue components.

### performance

- `noAccumulatingSpread` — Disallow the use of spread ( ... ) syntax on accumulators.
- `noAwaitInLoops` — Disallow await inside loops.
- `noBarrelFile` — Disallow the use of barrel file.
- `noDelete` — Disallow the use of the delete operator.
- `noDynamicNamespaceImportAccess` — Disallow accessing namespace imports dynamically.
- `noImgElement` — Prevent usage of <img> element in a Next.js project.
- `noNamespaceImport` — Disallow the use of namespace imports.
- `noReExportAll` — Avoid re-export all.
- `noUnwantedPolyfillio` — Prevent duplicate polyfills from Polyfill.io.
- `useGoogleFontPreconnect` — Ensure the preconnect attribute is used when using Google Fonts.
- `useSolidForComponent` — Enforce using Solid’s <For /> component for mapping an array to JSX elements.
- `useTopLevelRegex` — Require regex literals to be declared at the top level.

### security

- `noBlankTarget` — Disallow target="_blank" attribute without rel="noopener" .
- `noDangerouslySetInnerHtml` — Prevent the usage of dangerous JSX props
- `noDangerouslySetInnerHtmlWithChildren` — Report when a DOM element or a component uses both children and dangerouslySetInnerHTML prop.
- `noGlobalEval` — Disallow the use of global eval() .
- `noSecrets` — Disallow usage of sensitive data such as API keys and tokens.

### style

- `noCommonJs` — Disallow use of CommonJs module system in favor of ESM style imports.
- `noDefaultExport` — Disallow default exports.
- `noDoneCallback` — Disallow using a callback in asynchronous tests and hooks.
- `noEnum` — Disallow TypeScript enum.
- `noExportedImports` — Disallow exporting an imported variable.
- `noHeadElement` — Prevent usage of <head> element in a Next.js project.
- `noImplicitBoolean` — Disallow implicit true values on JSX boolean attributes
- `noInferrableTypes` — Disallow type annotations for variables, parameters, and class properties initialized with a literal expression.
- `noMagicNumbers` — Reports usage of “magic numbers” — numbers used directly instead of being assigned to named constants.
- `noNamespace` — Disallow the use of TypeScript’s namespace s.
- `noNegationElse` — Disallow negation in the condition of an if statement if it has an else clause.
- `noNestedTernary` — Disallow nested ternary expressions.
- `noNonNullAssertion` — Disallow non-null assertions using the ! postfix operator.
- `noParameterAssign` — Disallow reassigning function parameters.
- `noParameterProperties` — Disallow the use of parameter properties in class constructors.
- `noProcessEnv` — Disallow the use of process.env .
- `noRestrictedGlobals` — This rule allows you to specify global variable names that you don’t want to use in your application.
- `noRestrictedImports` — Disallow specified modules when loaded by import or require.
- `noRestrictedTypes` — Disallow user defined types.
- `noShoutyConstants` — Disallow the use of constants which its value is the upper-case version of its name.
- `noSubstr` — Enforce the use of String.slice() over String.substr() and String.substring() .
- `noUnusedTemplateLiteral` — Disallow template literals if interpolation and special-character handling are not needed
- `noUselessElse` — Disallow else block when the if block breaks early.
- `noYodaExpression` — Disallow the use of yoda expressions.
- `useArrayLiterals` — Disallow Array constructors.
- `useAsConstAssertion` — Enforce the use of as const over literal type and type annotation.
- `useAtIndex` — Use at() instead of integer index access.
- `useBlockStatements` — Requires following curly brace conventions.
- `useCollapsedElseIf` — Enforce using else if instead of nested if in else clauses.
- `useCollapsedIf` — Enforce using single if instead of nested if clauses.
- `useComponentExportOnlyModules` — Enforce declaring components only within modules that export React Components exclusively.
- `useConsistentArrayType` — Require consistently using either T[] or Array<T>
- `useConsistentBuiltinInstantiation` — Enforce the use of new for all builtins, except String , Number and Boolean .
- `useConsistentCurlyBraces` — This rule enforces consistent use of curly braces inside JSX attributes and JSX children.
- `useConsistentMemberAccessibility` — Require consistent accessibility modifiers on class properties and methods.
- `useConsistentObjectDefinitions` — Require the consistent declaration of object literals. Defaults to explicit definitions.
- `useConsistentTypeDefinitions` — Enforce type definitions to consistently use either interface or type .
- `useConst` — Require const declarations for variables that are only assigned once.
- `useDefaultParameterLast` — Enforce default function parameters and optional function parameters to be last.
- `useDefaultSwitchClause` — Require the default clause in switch statements.
- `useEnumInitializers` — Require that each enum member value be explicitly initialized.
- `useExplicitLengthCheck` — Enforce explicitly comparing the length , size , byteLength or byteOffset property of a value.
- `useExponentiationOperator` — Disallow the use of Math.pow in favor of the ** operator.
- `useExportType` — Promotes the use of export type for types.
- `useExportsLast` — Require that all exports are declared after all non-export statements.
- `useFilenamingConvention` — Enforce naming conventions for JavaScript and TypeScript filenames.
- `useForOf` — Prefer using for...of loops over standard for loops where possible.
- `useFragmentSyntax` — This rule enforces the use of <>...</> over <Fragment>...</Fragment> .
- `useGroupedAccessorPairs` — Enforce that getters and setters for the same property are adjacent in class and object definitions.
- `useImportType` — Promotes the use of import type for types.
- `useLiteralEnumMembers` — Require all enum members to be literal values.
- `useNamingConvention` — Enforce naming conventions for everything across a codebase.
- `useNodeAssertStrict` — Promotes the usage of node:assert/strict over node:assert .
- `useNodejsImportProtocol` — Enforces using the node: protocol for Node.js builtin modules.
- `useNumberNamespace` — Use the Number properties instead of global ones.
- `useNumericSeparators` — Enforce the use of numeric separators in numeric literals.
- `useObjectSpread` — Prefer object spread over Object.assign() when constructing new objects.
- `useReactFunctionComponents` — Enforce that components are defined as functions and never as classes.
- `useReadonlyClassProperties` — Enforce marking members as readonly if they are never modified outside the constructor.
- `useSelfClosingElements` — Prevent extra closing tags for components without children.
- `useShorthandAssign` — Require assignment operator shorthand where possible.
- `useShorthandFunctionType` — Enforce using function types instead of object type with call signatures.
- `useSingleVarDeclarator` — Disallow multiple variable declarations in the same variable statement
- `useSymbolDescription` — Require a description parameter for the Symbol() .
- `useTemplate` — Prefer template literals over string concatenation.
- `useThrowNewError` — Require new when throwing an error.
- `useThrowOnlyError` — Disallow throwing non- Error values.
- `useTrimStartEnd` — Enforce the use of String.trimStart() and String.trimEnd() over String.trimLeft() and String.trimRight() .
- `useUnifiedTypeSignatures` — Disallow overload signatures that can be unified into a single signature.

### suspicious

- `noAlert` — Disallow the use of alert , confirm , and prompt .
- `noApproximativeNumericConstant` — Use standard constants instead of approximated literals.
- `noArrayIndexKey` — Discourage the usage of Array index in keys.
- `noAssignInExpressions` — Disallow assignments in expressions.
- `noAsyncPromiseExecutor` — Disallows using an async function as a Promise executor.
- `noBitwiseOperators` — Disallow bitwise operators.
- `noCatchAssign` — Disallow reassigning exceptions in catch clauses.
- `noClassAssign` — Disallow reassigning class members.
- `noCommentText` — Prevent comments from being inserted as text nodes
- `noCompareNegZero` — Disallow comparing against -0
- `noConfusingLabels` — Disallow labeled statements that are not loops.
- `noConfusingVoidType` — Disallow void type outside of generic or return types.
- `noConsole` — Disallow the use of console .
- `noConstEnum` — Disallow TypeScript const enum
- `noConstantBinaryExpressions` — Disallow expressions where the operation doesn’t affect the value
- `noControlCharactersInRegex` — Prevents from having control characters and some escape sequences that match control characters in regular expression literals.
- `noDebugger` — Disallow the use of debugger
- `noDocumentCookie` — Disallow direct assignments to document.cookie .
- `noDocumentImportInPage` — Prevents importing next/document outside of pages/_document.jsx in Next.js projects.
- `noDoubleEquals` — Require the use of === and !== .
- `noDuplicateCase` — Disallow duplicate case labels.
- `noDuplicateClassMembers` — Disallow duplicate class members.
- `noDuplicateElseIf` — Disallow duplicate conditions in if-else-if chains
- `noDuplicateJsxProps` — Prevents JSX properties to be assigned multiple times.
- `noDuplicateObjectKeys` — Disallow two keys with the same name inside objects.
- `noDuplicateParameters` — Disallow duplicate function parameter name.
- `noDuplicateTestHooks` — A describe block should not contain duplicate hooks.
- `noEmptyBlockStatements` — Disallow empty block statements and static blocks.
- `noEmptyInterface` — Disallow the declaration of empty interfaces.
- `noEvolvingTypes` — Disallow variables from evolving into any type through reassignments.
- `noExplicitAny` — Disallow the any type usage.
- `noExportsInTest` — Disallow using export or module.exports in files containing tests
- `noExtraNonNullAssertion` — Prevents the wrong usage of the non-null assertion operator ( ! ) in TypeScript files.
- `noFallthroughSwitchClause` — Disallow fallthrough of switch clauses.
- `noFocusedTests` — Disallow focused tests.
- `noFunctionAssign` — Disallow reassigning function declarations.
- `noGlobalAssign` — Disallow assignments to native objects and read-only global variables.
- `noGlobalIsFinite` — Use Number.isFinite instead of global isFinite .
- `noGlobalIsNan` — Use Number.isNaN instead of global isNaN .
- `noHeadImportInDocument` — Prevent using the next/head module in pages/_document.js on Next.js projects.
- `noImplicitAnyLet` — Disallow use of implicit any type on variable declarations.
- `noImportAssign` — Disallow assigning to imported bindings
- `noIrregularWhitespace` — Disallows the use of irregular whitespace characters.
- `noLabelVar` — Disallow labels that share a name with a variable
- `noMisleadingCharacterClass` — Disallow characters made with multiple code points in character class syntax.
- `noMisleadingInstantiator` — Enforce proper usage of new and constructor .
- `noMisplacedAssertion` — Checks that the assertion function, for example expect , is placed inside an it() function call.
- `noMisrefactoredShorthandAssign` — Disallow shorthand assign when variable appears on both sides.
- `noNonNullAssertedOptionalChain` — Disallow non-null assertions after optional chaining expressions.
- `noOctalEscape` — Disallow octal escape sequences in string literals
- `noPrototypeBuiltins` — Disallow direct use of Object.prototype builtins.
- `noReactSpecificProps` — Prevents React-specific JSX properties from being used.
- `noRedeclare` — Disallow variable, function, class, and type redeclarations in the same scope.
- `noRedundantUseStrict` — Prevents from having redundant "use strict" .
- `noSelfCompare` — Disallow comparisons where both sides are exactly the same.
- `noShadowRestrictedNames` — Disallow identifiers from shadowing restricted names.
- `noSkippedTests` — Disallow disabled tests.
- `noSparseArray` — Prevents the use of sparse arrays (arrays with holes).
- `noSuspiciousSemicolonInJsx` — It detects possible “wrong” semicolons inside JSX elements.
- `noTemplateCurlyInString` — Disallow template literal placeholder syntax in regular strings.
- `noThenProperty` — Disallow then property.
- `noTsIgnore` — Prevents the use of the TypeScript directive @ts-ignore .
- `noUnassignedVariables` — Disallow let or var variables that are read but never assigned.
- `noUnsafeDeclarationMerging` — Disallow unsafe declaration merging between interfaces and classes.
- `noUnsafeNegation` — Disallow using unsafe negation.
- `noUselessEscapeInString` — Disallow unnecessary escapes in string literals.
- `noUselessRegexBackrefs` — Disallow useless backreferences in regular expression literals that always match an empty string.
- `noVar` — Disallow the use of var
- `noWith` — Disallow with statements in non-strict contexts.
- `useAdjacentOverloadSignatures` — Disallow the use of overload signatures that are not next to each other.
- `useAwait` — Ensure async functions utilize await .
- `useDefaultSwitchClauseLast` — Enforce default clauses in switch statements to be last
- `useErrorMessage` — Enforce passing a message value when creating a built-in error.
- `useGetterReturn` — Enforce get methods to always return a value.
- `useGoogleFontDisplay` — Enforces the use of a recommended display strategy with Google Fonts.
- `useGuardForIn` — Require for-in loops to include an if statement.
- `useIsArray` — Use Array.isArray() instead of instanceof Array .
- `useIterableCallbackReturn` — Enforce consistent return values in iterable callbacks.
- `useNamespaceKeyword` — Require using the namespace keyword over the module keyword to declare TypeScript namespaces.
- `useNumberToFixedDigitsArgument` — Enforce using the digits argument with Number#toFixed() .
- `useStaticResponseMethods` — Use static Response methods instead of new Response() constructor when possible.
- `useStrictMode` — Enforce the use of the directive "use strict" in script files.

## JSON

### nursery

- `noDuplicateDependencies` — Prevent the listing of duplicate dependencies.
- `useRequiredScripts` — Enforce the presence of required scripts in package.json.

### suspicious

- `noBiomeFirstException` — Prevents the misuse of glob patterns inside the files.includes field.
- `noDuplicateObjectKeys` — Disallow two keys with the same name inside objects.
- `noQuickfixBiome` — Disallow the use if quickfix.biome inside editor settings file.
- `useBiomeIgnoreFolder` — Promotes the correct usage for ignoring folders in the configuration file.

## CSS

### a11y

- `useGenericFontNames` — Disallow a missing generic family keyword within font families.

### complexity

- `noImportantStyles` — Disallow the use of the !important style.

### correctness

- `noInvalidDirectionInLinearGradient` — Disallow non-standard direction values for linear gradient functions.
- `noInvalidGridAreas` — Disallows invalid named grid areas in CSS Grid Layouts.
- `noInvalidPositionAtImportRule` — Disallow the use of @import at-rules in invalid positions.
- `noMissingVarFunction` — Disallow missing var function for css variables.
- `noUnknownFunction` — Disallow unknown CSS value functions.
- `noUnknownMediaFeatureName` — Disallow unknown media feature names.
- `noUnknownProperty` — Disallow unknown properties.
- `noUnknownPseudoClass` — Disallow unknown pseudo-class selectors.
- `noUnknownPseudoElement` — Disallow unknown pseudo-element selectors.
- `noUnknownTypeSelector` — Disallow unknown type selectors.
- `noUnknownUnit` — Disallow unknown CSS units.
- `noUnmatchableAnbSelector` — Disallow unmatchable An+B selectors.

### nursery

- `noDeprecatedMediaType` — Disallow deprecated media types.
- `noEmptySource` — Disallow empty sources.
- `noExcessiveLinesPerFile` — Restrict the number of lines in a file.
- `noHexColors` — Disallow hex colors.

### style

- `noDescendingSpecificity` — Disallow a lower specificity selector from coming after a higher specificity selector.
- `noValueAtRule` — Disallow use of @value rule in CSS modules.

### suspicious

- `noDuplicateAtImportRules` — Disallow duplicate @import rules.
- `noDuplicateCustomProperties` — Disallow duplicate custom properties within declaration blocks.
- `noDuplicateFontNames` — Disallow duplicate names within font families.
- `noDuplicateProperties` — Disallow duplicate properties within declaration blocks.
- `noDuplicateSelectorsKeyframeBlock` — Disallow duplicate selectors within keyframe blocks.
- `noEmptyBlock` — Disallow CSS empty blocks.
- `noImportantInKeyframe` — Disallow invalid !important within keyframe declarations
- `noIrregularWhitespace` — Disallows the use of irregular whitespace characters.
- `noShorthandPropertyOverrides` — Disallow shorthand properties that override related longhand properties.
- `noUnknownAtRules` — Disallow unknown at-rules.
- `noUselessEscapeInString` — Disallow unnecessary escapes in string literals.

## GraphQL

### correctness

- `useGraphqlNamedOperations` — Enforce specifying the name of GraphQL operations.

### nursery

- `noDuplicateArgumentNames` — Require all argument names for fields & directives to be unique.
- `noDuplicateEnumValueNames` — Require all enum value names to be unique.
- `noDuplicateFieldDefinitionNames` — Require all fields of a type to be unique.
- `noDuplicateGraphqlOperationName` — Enforce unique operation names across a GraphQL document.
- `noDuplicateInputFieldNames` — Require fields within an input object to be unique.
- `noDuplicateVariableNames` — Require all variable definitions to be unique.
- `noEmptySource` — Disallow empty sources.
- `noExcessiveLinesPerFile` — Restrict the number of lines in a file.
- `noRootType` — Disallow the usage of specified root types
- `useConsistentGraphqlDescriptions` — Require all descriptions to follow the same style (either block or inline) to  maintain consistency and improve readability across the schema.
- `useDeprecatedDate` — Require the @deprecated directive to specify a deletion date.
- `useInputName` — Require mutation argument to be always called “input”
- `useLoneAnonymousOperation` — Disallow anonymous operations when more than one operation specified in document.
- `useLoneExecutableDefinition` — Require queries, mutations, subscriptions or fragments each to be located in separate files.

### style

- `useDeprecatedReason` — Require specifying the reason argument when using @deprecated directive
- `useGraphqlNamingConvention` — Validates that all enum values are capitalized.

### suspicious

- `noDuplicateFields` — No duplicated fields in GraphQL operations.
