import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { LibrariesModule } from './libraries/libraries.module';
import { UsersModule } from './users/users.module';
import { GuardsModule } from './guards/guards.module';
import { BooksModule } from './books/books.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const isRender = config.get<string>('RENDER') === 'true';
        const sslConfig = { rejectUnauthorized: false };

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            // Render Postgres requires TLS. Keep this on whenever DATABASE_URL is used.
            ssl: sslConfig,
            extra: {
              ssl: sslConfig,
            },
            autoLoadEntities: true,
            synchronize: !isProduction,
          };
        }

        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASS'),
          database: config.get<string>('DB_NAME'),
          // If split vars are used on Render/production, still force SSL.
          ssl: isProduction || isRender ? sslConfig : false,
          extra: isProduction || isRender ? { ssl: sslConfig } : {},
          autoLoadEntities: true,
          synchronize: !isProduction,
        };
      },
      inject: [ConfigService],
    }),
    LibrariesModule,
    UsersModule,
    AuthModule,
    GuardsModule,
    BooksModule,
    AssignmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
