import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../common/interfaces/jwt-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new managed user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createManagedUser(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.usersService.findAllManagedUsers();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a managed user' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.usersService.updateManagedUser(id, dto, request.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a managed user' })
  remove(@Param('id') id: string, @Req() request: Request & { user: JwtUser }) {
    return this.usersService.removeManagedUser(id, request.user.sub);
  }
}
